// One answer to "which function is this code part of", shared by every rule that scores a function.
//
// Three rules measure a function — `health/cognitive-complexity`, `health/accumulator-count` and
// `health/return-width` — and they must agree about where one function ends and the next begins, or
// a body can be over the line for one rule and invisible to another, and the numbers stop describing
// one thing.
//
// The answer here is the reader's, not the parser's. An ANONYMOUS inline callback has no name to
// look up and no call site to arrive from: `items.filter((x) => …)` is part of the statement it sits
// in, and its branches are branches of the function holding that statement. A NAMED function is
// somewhere a reader goes on purpose, so it carries its own score and stops the walk.
//
// That split is the whole of what this module decides. What each rule does with a body is its own.
//
// NEGATIVE SPACE: a name is a syntactic binding, never a judgement about whether the function is
// worth arriving at. `const f = (x) => x` is named, so a file can push a body behind a `const` and
// split one score into two — which is the extraction the rules ask for, done for the wrong reason
// but leaving the same code. `lib/transparent-wrappers.ts`-style unwrapping is deliberately NOT
// applied to the parent test: `const f = ((x) => x) as Fn` binds through a cast, reads as named to
// a person, and reads as anonymous here.

import { type ESTree } from "@oxlint/plugins";
import { staticKeyName } from "./static-key-name.ts";

/** Every node the language calls a function, including the two TypeScript declares with no body. */
export type FunctionNode = ESTree.Function | ESTree.ArrowFunctionExpression;

const FUNCTION_TYPES = new Set([
  "FunctionDeclaration",
  "FunctionExpression",
  "ArrowFunctionExpression",
  "TSDeclareFunction",
  "TSEmptyBodyFunctionExpression",
]);

export function isFunctionNode(node: ESTree.Node): node is FunctionNode {
  return FUNCTION_TYPES.has(node.type);
}

/**
 * Whether a reader arrives at this function by name rather than reading through it in place.
 *
 * Asked of the BINDING, which is why an arrow assigned to a `const` counts and the same arrow passed
 * to `.map` does not. A method and a class field hold a name the same way a variable does.
 */
export function isNamedHelper(fn: FunctionNode): boolean {
  if (fn.type === "FunctionDeclaration" || fn.type === "TSDeclareFunction") return fn.id !== null;

  const parent: ESTree.Node | null | undefined = fn.parent;
  if (parent === null || parent === undefined) return false;

  switch (parent.type) {
    case "VariableDeclarator":
      return parent.init === fn && parent.id.type === "Identifier";
    case "MethodDefinition":
    case "TSAbstractMethodDefinition":
    case "PropertyDefinition":
    case "TSAbstractPropertyDefinition":
      return true;
    case "Property":
      return parent.value === fn;
    default:
      return false;
  }
}

/**
 * What to call this function in a diagnostic, and where to underline it.
 *
 * The target is the NAME where there is one, never the function node: a report against a 300-line
 * declaration underlines 300 lines, which is the one shape these rules exist to talk about.
 */
export function functionSubjectName(fn: FunctionNode): {
  name: string;
  target: ESTree.Node;
} {
  if (fn.type !== "ArrowFunctionExpression" && fn.id !== null) {
    return { name: fn.id.name, target: fn.id };
  }

  const parent: ESTree.Node | null | undefined = fn.parent;
  if (parent !== null && parent !== undefined) {
    if (parent.type === "VariableDeclarator" && parent.id.type === "Identifier") {
      return { name: parent.id.name, target: parent.id };
    }
    if (
      parent.type === "MethodDefinition" ||
      parent.type === "TSAbstractMethodDefinition" ||
      parent.type === "PropertyDefinition" ||
      parent.type === "TSAbstractPropertyDefinition" ||
      parent.type === "Property"
    ) {
      const key = staticKeyName(parent.key, parent.computed);
      if (key !== undefined) return { name: key, target: parent.key };
    }
  }

  // An anonymous function that is nonetheless a subject — nothing encloses it to roll it into. It
  // has no name to print, so the message names its shape instead.
  return { name: "This function", target: fn };
}

/**
 * The AST children of `node`, in no particular order.
 *
 * The node's own fields rather than `sourceCode.visitorKeys`, deliberately. The key map is a list of
 * node types, and a walk driven by it stops dead at a type the map does not name — the AST grows one
 * and a function's body stops being counted halfway through, reported as a small number rather than
 * as an error. Reading the fields cannot go stale that way: a new child field is a new child.
 */
export function childNodes(node: ESTree.Node): ESTree.Node[] {
  const children: ESTree.Node[] = [];
  for (const [key, value] of Object.entries(node as unknown as Record<string, unknown>)) {
    if (NON_CHILD_KEYS.has(key)) continue;
    if (Array.isArray(value)) {
      for (const item of value) if (isNode(item)) children.push(item);
    } else if (isNode(value)) {
      children.push(value);
    }
  }
  return children;
}

/** `parent` is the one field that walks UP, so following it turns any walk into a cycle. */
const NON_CHILD_KEYS = new Set(["parent", "range", "loc"]);

/**
 * A child is an object carrying a `type` string. The positional metadata beside it — `start`, `end`,
 * a literal's `value`, a template element's `cooked` — carries none, so nothing here has to know
 * which fields those are.
 */
function isNode(value: unknown): value is ESTree.Node {
  return (
    typeof value === "object" && value !== null && typeof (value as ESTree.Node).type === "string"
  );
}

/**
 * Every function in `program` that carries a score of its own, outermost first.
 *
 * A named function is always one. An anonymous one is a subject only when nothing encloses it to
 * roll it into — a bare `export default () => …`, or a callback at module top level. Without that
 * second case the largest anonymous function in a file could be measured by nothing at all, and the
 * silence would look exactly like a clean file.
 */
export function functionSubjects(program: ESTree.Program): FunctionNode[] {
  const subjects: FunctionNode[] = [];

  const walk = (node: ESTree.Node, insideSubject: boolean) => {
    for (const child of childNodes(node)) {
      if (!isFunctionNode(child)) {
        walk(child, insideSubject);
        continue;
      }
      const isSubject = isNamedHelper(child) || !insideSubject;
      if (isSubject) subjects.push(child);
      walk(child, insideSubject || isSubject);
    }
  };

  walk(program, false);
  return subjects;
}

/**
 * Visits every node in `fn`'s body as the READER reads it: through anonymous callbacks, stopping at
 * every named function, which is measured on its own.
 *
 * The parameter list is skipped along with everything else outside the body — a default value is
 * part of the signature, not of the code the function runs.
 */
export function walkOwnBody(fn: FunctionNode, visit: (node: ESTree.Node) => void): void {
  const body: ESTree.Node | null | undefined = fn.body;
  if (body === null || body === undefined) return;

  const walk = (node: ESTree.Node) => {
    if (isFunctionNode(node) && isNamedHelper(node)) return;
    visit(node);
    for (const child of childNodes(node)) walk(child);
  };

  walk(body);
}
