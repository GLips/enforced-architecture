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
import type { ESTree } from "@oxlint/plugins";
import { declaresTypePredicate } from "../lib/type-annotations.ts";

/**
 * Whether the NEAREST enclosing function declares a type predicate (`value is T`, `asserts value`).
 *
 * The walk stops at the first function on purpose: a callback nested inside a guard has its own
 * signature and its own (absent) predicate, so a `typeof` there is not covered by the outer
 * guard's contract and still reports.
 *
 * What counts as a guard — inline, or declared on an overload signature the implementation widens
 * away — is `lib/type-annotations.ts`'s to answer, because `types/no-broad-parameters` exempts the
 * value that same guard vouches for. Two readings of "is this a guard" would let one rule demand
 * the signature the other reports.
 */
function isInsideTypeGuard(node: ESTree.Node): boolean {
  let current: ESTree.Node | null = node.parent;
  while (current !== null && current.type !== "Program") {
    if (
      current.type === "ArrowFunctionExpression" ||
      current.type === "FunctionDeclaration" ||
      current.type === "FunctionExpression"
    ) {
      return declaresTypePredicate(current);
    }
    current = current.parent;
  }
  return false;
}

export const noRuntimeTypeofRule = defineTreeRule({
  meta: {
    type: "problem",
    messages: {
      runtimeTypeof:
        "A `typeof` check narrows a representation without establishing a contract — a string is not yet a UserId. Parse this value at its I/O boundary and branch on the domain value instead.",
    },
  },
  create(context) {

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
