// ─── types/no-runtime-typeof ─────────────────────────────────────────
//
// Tag:      types
// Mechanism: oxlint JS plugin (per-file, real-time)
// Blocking: Yes
//
// Prevents: Every runtime `typeof` check.
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
// Excludes: Nothing at runtime. TypeScript's type-level `typeof X` is a
//           different node (`TSTypeQuery`) and is untouched.
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
// 2. A middle option — `ALLOWED_TYPEOF_OPERANDS`:
//    There is deliberately no allowlist constant in this file. Adding
//    one for `window`, `document`, and `globalThis` covers the
//    environment guards and is about six lines; it is left out rather
//    than shipped empty because a config knob nobody sets is worse than
//    an edit the Adapt section describes.
//
// 3. Registration:
//    Add the rule to the project's oxlint plugin
//    (`rules: { "no-runtime-typeof": noRuntimeTypeofRule }`) and turn
//    it on in `.oxlintrc.json`
//    (`"<plugin>/no-runtime-typeof": "error"`).
//
// ──────────────────────────────────────────────────────────────────────

import { defineRule } from "@oxlint/plugins";
import { isArchitectureExemptPath } from "../lib/architecture-exempt-paths.ts";

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
        if (node.operator === "typeof") context.report({ node, messageId: "runtimeTypeof" });
      },
    };
  },
});
