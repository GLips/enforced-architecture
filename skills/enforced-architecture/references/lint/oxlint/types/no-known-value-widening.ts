// ─── types/no-known-value-widening ───────────────────────────────────
//
// Makes sure: A literal keeps the type TypeScript read from it. No annotation
// on a variable, a class property or a return replaces a literal's own keys
// with `unknown`, `any`, `object` or an open dictionary. So `handlers.stpo` is
// an error, the editor lists the keys, and `satisfies` checks the values
// without that loss.
//
// `Record<string, Handler>` reports although its value type is precise. The
// loss is in the keys. That surprises readers, and it is the point of the rule —
// and it is the one line where this rule and its two siblings must disagree.
// `lib/type-annotations.ts` answers "is this an open dictionary" for all three;
// this rule reads only the KEY half of that answer, so `Record<string, Handler>`
// reports here and is silent in `types/no-opaque-record` and
// `types/no-widen-then-assert`, which both go on to ask whether the VALUE is
// opaque. Every spec pins that row.
//
// A CLOSED key domain is not a widening. `Record<'start' | 'stop', Handler>`,
// `{ [K in keyof Config]: Handler }`, a local enum and `(typeof KEYS)[number]`
// name exactly the keys the literal has, so they delete nothing and are legal —
// the same reading that keeps a dirty-field tracker legal in
// `types/no-opaque-record`, and `lib/type-annotations.ts` owns the list.
//
// A domain the walk cannot RESOLVE reports even when it is finite in fact: an
// imported alias or enum, a member of an imported enum, a conditional type, and
// an indexed access into a named type such as `Row['id']`, which is every string
// whenever `Row.id` is one. That is deliberate — the alternative goes silent on every key
// spelling nobody enumerated — but it means a report here can be a false one, and
// the fix is to spell the union or name the shape rather than to reach for
// `satisfies`, which deletes the exhaustiveness check the annotation was for.
//
// An empty object or array literal is legal. `const acc: Record<string,
// Handler> = {}` is an accumulator that gets the type it grows into, which is
// the one case where the annotation adds information.
//
// The value must be written at the annotation. `const base = {…}; const h:
// Record<string, Handler> = base;` is missed on purpose, and so is any value
// from a call: `const x: unknown = parse(text)` is a boundary. To follow a
// binding you need the scope resolution in `types/no-widen-then-assert`, and
// the indirect spelling carries real false-positive risk.
//
// SCOPE, and it is the same for every TREE-SCOPED rule in this catalog — which
// is every rule but `testing/no-module-mocking`, whose subject is a test file and
// which is therefore enabled globally. This rule is silent outside the declared
// trees, and silent on the files `isArchitectureExemptSourcePath` names inside
// them — tests, scripts, generated and ambient modules. Neither
// silence is coverage. `lib/define-tree-rule.ts` owns both, which is why no rule
// body checks either one.
// ──────────────────────────────────────────────────────────────────────

import { defineTreeRule } from "../lib/define-tree-rule.ts";
import { type ESTree } from "@oxlint/plugins";
import {
  collectLocalTypeFacts,
  type LocalTypeFacts,
  lexicalTypeParameterNames,
  openDictionaryValueType,
  resolvesToBroadType,
} from "../lib/type-annotations.ts";

const BROAD_KEYWORDS = new Set(["TSUnknownKeyword", "TSAnyKeyword", "TSObjectKeyword"]);

// Values whose precise type is visible in the source, so an annotation over them can only subtract.
// A CallExpression is absent on purpose: a call is a boundary, not a value that carries its
// own evidence.
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

export const noKnownValueWideningRule = defineTreeRule({
  meta: {
    type: "problem",
    messages: {
      widening:
        "This annotation discards what TypeScript already knew about the value — the literal's own keys and types. Use `satisfies {{target}}` to check it without widening it, or drop the annotation and let inference do the work.",
    },
  },
  create(context) {

    let facts: LocalTypeFacts = {
      aliases: new Map(),
      enums: new Set(),
      visitorKeys: context.sourceCode.visitorKeys,
    };

    // The KEY half of `lib/type-annotations.ts`'s open-dictionary answer, and only that half. What
    // the annotation deletes is the literal's keys, so the value type is not consulted:
    // `Record<string, Handler>` reports here and is silent in `types/no-opaque-record` and
    // `types/no-widen-then-assert`, which is the one place the three rules are meant to diverge.
    // A closed key domain deletes nothing — `Record<'start' | 'stop', Handler>` and
    // `{ [K in keyof Config]: Handler }` name the same keys the literal has.
    const isWideningTarget = (type: ESTree.TSType): boolean => {
      const shadowed = lexicalTypeParameterNames(type, context.sourceCode.visitorKeys);
      if (resolvesToBroadType(type, BROAD_KEYWORDS, facts.aliases, shadowed)) return true;
      return openDictionaryValueType(type, facts) !== null;
    };

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
      Program(node) {
        facts = collectLocalTypeFacts(node, context.sourceCode.visitorKeys);
      },
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
