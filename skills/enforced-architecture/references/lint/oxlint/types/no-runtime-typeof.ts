// ─── types/no-runtime-typeof ─────────────────────────────────────────
//
// Tag:      types
// Mechanism: oxlint JS plugin (per-file, real-time)
// Blocking: Yes
//
// Prevents: Runtime `typeof` checks outside type-guard bodies.
//
//             if (typeof input === "string") { useName(input); }
//
//           A `typeof` test narrows a REPRESENTATION without
//           establishing a CONTRACT. Knowing a value is a string does
//           not make it a `UserId`, an ISO date, or an email — and the
//           branch that follows invariably treats it as one. It is
//           parsing done by eye, one field at a time, at whatever point
//           in the program the value happened to arrive.
//
//           The fix is always the same shape: decode the value once at
//           its I/O boundary with a schema, then branch on the domain
//           value rather than on its shape in memory.
//
//           READ THIS BEFORE ADOPTING. This is the bluntest rule in the
//           catalog and it WILL fire on code that is correct. It bans
//           the SSR guard (`typeof window === "undefined"`) and the
//           discrimination of a union the type system already handed
//           you (`typeof node.value === "string"` where `value` is
//           `string | number | boolean`). Those are legitimate and this
//           rule cannot tell them apart — see note 1.
//
// Excludes: The DIRECT body of a type guard — a function whose return
//           type is a predicate (`value is Invoice`, `asserts value is
//           Invoice`). That is the one place a representation check
//           produces a contract instead of dodging one: the predicate
//           names what was established and every caller narrows through
//           it. A closure nested inside a guard is NOT exempt — the
//           nearest enclosing function decides, so the check cannot
//           drift away from the signature that vouches for it.
//
//           An OVERLOADED guard is exempt too: TypeScript puts the
//           predicate on the signature and widens the implementation's
//           return type to `boolean`, so the published contract is the
//           predicate even though the body's own annotation is not. A
//           method overload set is not covered — see
//           `hasPredicateOverload`.
//
//           TypeScript's type-level `typeof X` is a different node
//           (`TSTypeQuery`) and is untouched.
//
// Applies:  All .ts and .tsx files EXCEPT:
//           - Test files and scripts
//
// Error:    "A `typeof` check narrows a representation without
//            establishing a contract — a string is not yet a UserId.
//            Parse this value at its I/O boundary and branch on the
//            domain value instead."
//
// ── Adapt ─────────────────────────────────────────────────────────────
//
// 1. Why this is a blanket ban, and what that costs:
//    The rule cannot distinguish parsing-by-eye from discriminating a
//    union the compiler already narrowed, because this tier has NO TYPE
//    INFORMATION — an oxlint JS plugin sees syntax only, so it cannot
//    ask whether the operand is `unknown` or `string | number`. The ban
//    is a tooling limit hardened into a policy, not a claim that every
//    `typeof` is wrong.
//
//    Two honest ways to run it:
//      a. Blanket ban plus per-line disables. Expect several in any
//         real codebase, most of them on AST or union discrimination.
//         Pair it with a convention that every disable states a reason,
//         or the suppressions become invisible.
//      b. Narrow the trigger: report only when the operand resolves to
//         a parameter annotated `unknown`/`any`, or a member access off
//         one. That is the actual defect and it is reachable from the
//          AST — `types/no-widen-then-assert` in this tag already does
//         the scope resolution it needs. More code, far fewer false
//         positives.
//
// 2. The type-guard exemption cuts the other way too:
//    A hand-written guard is still hand-parsing — a schema-first
//    project may reasonably want `isInvoice` to be a schema call, not
//    a `typeof` cascade. To restore the full blanket ban, delete
//    `isInsideTypeGuard` and its call. It ships on because the guard
//    is the one spelling where the check leaves a named, reusable
//    contract behind, which is the exact behavior the message asks for.
//
// 3. A middle option — `ALLOWED_TYPEOF_OPERANDS`:
//    There is deliberately no allowlist constant in this file. Adding
//    one for `window`, `document`, and `globalThis` covers the
//    environment guards and is about six lines; it is left out rather
//    than shipped empty because a config knob nobody sets is worse than
//    an edit the Adapt section describes.
//
// 4. Registration:
//    Add the rule to the project's oxlint plugin
//    (`rules: { "no-runtime-typeof": noRuntimeTypeofRule }`) and turn
//    it on in `.oxlintrc.json`
//    (`"<plugin>/no-runtime-typeof": "error"`).
//
// ──────────────────────────────────────────────────────────────────────

import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { isArchitectureExemptPath } from "../lib/architecture-exempt-paths.ts";

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
    if (isArchitectureExemptPath(context.filename)) return {};

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
