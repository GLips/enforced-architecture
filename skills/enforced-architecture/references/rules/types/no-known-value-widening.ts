// ─── types/no-known-value-widening ───────────────────────────────────
//
// Tag:      types
// Mechanism: oxlint JS plugin (per-file, real-time)
// Blocking: Yes
//
// Prevents: An explicit broad annotation on a value the compiler could
//           already see precisely:
//
//             const handlers: Record<string, Handler> = {
//               start: startHandler,
//               stop: stopHandler,
//             };
//
//           TypeScript knew this object has exactly `start` and `stop`.
//           The annotation replaces that with "some strings, maybe" —
//           so `handlers.stpo` is now `Handler` instead of an error,
//           and no editor can complete the keys. The annotation was
//           added to CHECK the object, and it checked it by deleting
//           what it knew.
//
//           `satisfies` is the operator that does what the annotation
//           was reaching for: it verifies every value against `Handler`
//           and keeps the literal keys. It did not exist before
//           TypeScript 4.9, which is why the annotation habit is so
//           widespread in training data and so common in generated
//           code.
//
//           The same applies to `unknown`, `any`, and `object` on a
//           value written out in front of you: there is nothing to
//           check and everything to lose.
//
// Excludes: An empty object or array literal. `const acc: Record<string,
//           Handler> = {}` is an accumulator being given the type it
//           will grow into, which is the annotation doing real work.
//
//           Values that are not self-evident — anything from a call.
//           `const x: unknown = parse(text)` is a boundary, and
//           `types/no-widen-then-assert` is the rule for what happens
//           to it afterwards.
//
// Applies:  All .ts and .tsx files EXCEPT:
//           - Test files and scripts
//
// Error:    "This annotation discards what TypeScript already knew
//            about the value — the literal's own keys and types.
//            Use `satisfies {{target}}` to check it without widening
//            it, or drop the annotation and let inference do the work."
//
// ── Adapt ─────────────────────────────────────────────────────────────
//
// 1. What counts as a widening target — `isWideningTarget`:
//    `unknown`, `any`, `object`, and any open-keyed dictionary
//    (`Record<…>`, an index signature, a mapped type). Note that
//    `Record<string, Handler>` counts even though its VALUE type is
//    precise: the loss is in the KEYS. That surprises people, and it is
//    the whole point of the rule.
//
// 2. Direct literals only:
//    The value must be written at the annotation. A value reached
//    through an intermediate `const` is not followed, so
//    `const base = {…}; const h: Record<string, Handler> = base;` is
//    missed. Following it needs the scope resolution
//    `types/no-widen-then-assert` demonstrates; it is left out here
//    because the direct spelling is the overwhelming majority and the
//    indirect one has real false-positive risk.
//
// 3. `satisfies` requires TypeScript 4.9:
//    On an older compiler the fix the message names does not exist and
//    the honest advice is "drop the annotation". Reword the message
//    before adopting, or the rule sends people somewhere they cannot go.
//
// 4. Registration:
//    Add the rule to the project's oxlint plugin
//    (`rules: { "no-known-value-widening": noKnownValueWideningRule }`)
//    and turn it on in `.oxlintrc.json`
//    (`"<plugin>/no-known-value-widening": "error"`).
//
// ──────────────────────────────────────────────────────────────────────

import { defineRule, type ESTree } from "@oxlint/plugins";
import { isArchitectureExemptPath } from "../lib/architecture-exempt-paths.ts";

const BROAD_KEYWORDS = new Set(["TSUnknownKeyword", "TSAnyKeyword", "TSObjectKeyword"]);

// Values whose precise type is visible in the source, so an annotation over them can only subtract.
// A CallExpression is absent on purpose — see Excludes.
const SELF_EVIDENT = new Set([
  "ArrayExpression",
  "ArrowFunctionExpression",
  "ClassExpression",
  "FunctionExpression",
  "Literal",
  "NewExpression",
  "ObjectExpression",
  "TemplateLiteral",
]);

function isOpenDictionaryType(type: ESTree.TSType): boolean {
  // Any `Record<…>`, whatever its value type: the key domain is what the literal knew and the
  // annotation throws away. `Record<string, Handler>` is the motivating case, not an edge.
  if (
    type.type === "TSTypeReference" &&
    type.typeName.type === "Identifier" &&
    type.typeName.name === "Record"
  ) {
    return true;
  }
  if (type.type === "TSMappedType") return true;
  return (
    type.type === "TSTypeLiteral" &&
    type.members.some((member) => member.type === "TSIndexSignature")
  );
}

function isWideningTarget(type: ESTree.TSType): boolean {
  return BROAD_KEYWORDS.has(type.type) || isOpenDictionaryType(type);
}

// An empty literal is an accumulator being given the type it will grow into — the one case where
// the annotation is doing real work rather than deleting it.
function isEmptyLiteral(expression: ESTree.Expression): boolean {
  if (expression.type === "ObjectExpression") return expression.properties.length === 0;
  if (expression.type === "ArrayExpression") return expression.elements.length === 0;
  return false;
}

function enclosingFunctionReturnType(node: ESTree.Node): ESTree.TSTypeAnnotation | null {
  let current: ESTree.Node | null = node.parent;
  while (current !== null && current.type !== "Program") {
    if (
      current.type === "ArrowFunctionExpression" ||
      current.type === "FunctionDeclaration" ||
      current.type === "FunctionExpression"
    ) {
      return current.returnType ?? null;
    }
    current = current.parent;
  }
  return null;
}

export const noKnownValueWideningRule = defineRule({
  meta: {
    type: "problem",
    messages: {
      widening:
        "This annotation discards what TypeScript already knew about the value — the literal's own keys and types. Use `satisfies {{target}}` to check it without widening it, or drop the annotation and let inference do the work.",
    },
  },
  create(context) {
    if (isArchitectureExemptPath(context.filename)) return {};

    const reportIfWidened = (
      value: ESTree.Expression | null | undefined,
      annotation: ESTree.TSTypeAnnotation | null | undefined,
    ) => {
      if (value === null || value === undefined) return;
      if (annotation === null || annotation === undefined) return;
      const target = annotation.typeAnnotation;
      if (!isWideningTarget(target)) return;
      if (!SELF_EVIDENT.has(value.type) || isEmptyLiteral(value)) return;
      context.report({
        node: value,
        messageId: "widening",
        data: { target: context.sourceCode.getText(target) },
      });
    };

    return {
      VariableDeclarator(node) {
        if (node.id.type !== "Identifier") return;
        reportIfWidened(node.init, node.id.typeAnnotation);
      },
      PropertyDefinition(node) {
        reportIfWidened(node.value, node.typeAnnotation);
      },
      ReturnStatement(node) {
        reportIfWidened(node.argument, enclosingFunctionReturnType(node));
      },
      // A concise arrow body is a return with no ReturnStatement node to visit.
      ArrowFunctionExpression(node) {
        if (node.body.type === "BlockStatement") return;
        reportIfWidened(node.body, node.returnType);
      },
    };
  },
});
