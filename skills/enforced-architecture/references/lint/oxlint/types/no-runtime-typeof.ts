// ─── types/no-runtime-typeof ─────────────────────────────────────────
//
// Makes sure: Each runtime `typeof` check sits in the body of a function that
// returns a type predicate. No branch elsewhere decides what a value is from
// its representation in memory. So when the shape of an input changes, you
// edit one named guard or one schema, and every caller narrows through it.
//
// Read this before you adopt the rule. It is the least precise rule in the
// catalog and it reports code that is correct: the SSR guard
// (`typeof window === "undefined"`), and the discrimination of a union the
// compiler already narrowed. This tier has no type information, so the rule
// cannot ask whether the operand is `unknown` or `string | number`. The ban is
// a tooling limit, not a position. Expect per-line disables, and pair the rule
// with a convention that each disable states a reason.
//
// There is no allowlist constant in this file. One for `window`, `document` and
// `globalThis` is about six lines and covers the environment guards. It is
// absent rather than empty, because a config knob nobody sets is worse than an
// edit described here.
//
// The type-guard exemption has a cost in a schema-first project, where
// `isInvoice` should be a schema call and not a chain of `typeof` tests. To
// restore the full ban, delete `isInsideTypeGuard` and its call.
// ──────────────────────────────────────────────────────────────────────

import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { classifyFileRole } from "../../policy/declared-trees.ts";

const STATEMENT_LIST_NODES = new Set([
  "BlockStatement",
  "Program",
  "StaticBlock",
  "TSModuleBlock",
]);

/**
 * Whether a body-less overload signature of the same name declares the predicate.
 *
 * An overloaded guard puts the predicate on the SIGNATURE and widens the implementation's own
 * return type — `function isInvoice(v: unknown): v is Invoice;` over
 * `function isInvoice(v: unknown): boolean { … }`. Read through the implementation alone, that
 * function vouches for nothing and every `typeof` in it reports, though the contract every caller
 * narrows through is exactly the predicate this rule exempts.
 *
 * Overloads must sit adjacent in the same statement list, so matching by name within that list is
 * the whole search. Class-method overloads are NOT covered: they are a different node
 * (`TSEmptyBodyFunctionExpression` in a `ClassBody`), and a guard written as a method is rare
 * enough that the extra arm would be untested weight.
 */
function hasPredicateOverload(implementation: ESTree.Node, name: string): boolean {
  let container: ESTree.Node | null = implementation.parent;
  while (container !== null && !STATEMENT_LIST_NODES.has(container.type)) {
    container = container.parent;
  }
  if (container === null) return false;

  const siblings: readonly ESTree.Node[] =
    "body" in container && Array.isArray(container.body) ? container.body : [];
  return siblings.some((statement) => {
    // An overload set on an exported guard wraps each signature, so the declaration to read is one
    // level down from the statement.
    const declaration =
      statement.type === "ExportNamedDeclaration" ? statement.declaration : statement;
    return (
      declaration?.type === "TSDeclareFunction" &&
      declaration.id?.name === name &&
      declaration.returnType?.typeAnnotation.type === "TSTypePredicate"
    );
  });
}

/**
 * Whether the NEAREST enclosing function declares a type predicate (`value is T`, `asserts value`).
 *
 * The walk stops at the first function on purpose: a callback nested inside a guard has its own
 * signature and its own (absent) predicate, so a `typeof` there is not covered by the outer
 * guard's contract and still reports.
 */
function isInsideTypeGuard(node: ESTree.Node): boolean {
  let current: ESTree.Node | null = node.parent;
  while (current !== null && current.type !== "Program") {
    if (
      current.type === "ArrowFunctionExpression" ||
      current.type === "FunctionDeclaration" ||
      current.type === "FunctionExpression"
    ) {
      if (current.returnType?.typeAnnotation.type === "TSTypePredicate") return true;
      return current.type === "FunctionDeclaration" && current.id !== null
        ? hasPredicateOverload(current, current.id.name)
        : false;
    }
    current = current.parent;
  }
  return false;
}

export const noRuntimeTypeofRule = defineRule({
  meta: {
    type: "problem",
    messages: {
      runtimeTypeof:
        "A `typeof` check narrows a representation without establishing a contract — a string is not yet a UserId. Parse this value at its I/O boundary and branch on the domain value instead.",
    },
  },
  create(context) {
    if (classifyFileRole(context.filename) === undefined) return {};

    return {
      // Only the runtime operator. TypeScript's type-level `typeof X` parses to TSTypeQuery, so
      // `type T = typeof config` is never reached from here.
      UnaryExpression(node) {
        if (node.operator !== "typeof" || isInsideTypeGuard(node)) return;
        context.report({ node, messageId: "runtimeTypeof" });
      },
    };
  },
});
