// ─── effect/no-effect-catchallcause ───────────────────────────────────
//
// Tag:       effect
// Mechanism: oxlint JS plugin (per-file, real-time)
// Blocking:  Yes
//
// Prevents: `Effect.catchAllCause` and `Effect.catchAllDefect`.
//
//           A `Cause` carries two different things: the failures this
//           effect declared, and the defects it never did — a thrown
//           exception, a broken invariant, an interruption. Catching the
//           cause catches both, so a bug is handled with the same code
//           path as an expected error and the process carries on in the
//           state that produced it. The crash was the report; catching
//           the cause deletes it and leaves a program that is wrong
//           quietly instead of loudly.
//
//           Catch what the type declares — `Effect.catchTag` for one
//           error, `Effect.catchAll` for all of them — and let defects
//           travel to the runtime boundary, where one supervisor logs the
//           cause and the fiber dies.
//
// Applies:  All .ts and .tsx files EXCEPT test files and scripts.
//
// Error:    "Effect.catchAllCause catches defects as well as declared
//            errors, so a bug is handled like an expected failure and
//            the program continues in the state that produced it. Catch
//            the declared errors with Effect.catchTag or Effect.catchAll
//            and let defects reach the runtime boundary."
//
// Negative space: An aliased import (`import { catchAllCause as recover }`)
//                 is not tracked — this tier has no scope resolution, and
//                 renaming an import to evade a lint rule is a different
//                 problem from the one this rule exists to catch.
//
// ── Adapt ─────────────────────────────────────────────────────────────
//
// 1. What is banned — `CAUSE_CATCH_METHODS`:
//    `catchAllDefect` is in the set with `catchAllCause` because it is
//    the same decision written more precisely, and it is the spelling
//    reached for once the first is refused. Drop it if the project has a
//    genuine defect-quarantine boundary (a plugin host, a job runner
//    isolating third-party handlers) — and if it does, keep that
//    boundary in one named module rather than allowing the call
//    everywhere.
//
// 2. Cause INSPECTION is not the target and is not matched.
//    `Effect.sandbox`, `Effect.tapErrorCause`, `Cause.pretty`, and
//    `Effect.catchSomeCause` narrowing to one known defect all read the
//    cause without swallowing it. Only the total catchers are banned.
//
// 3. The member name is matched without checking the namespace,
//    so `Effect.catchAllCause`, a namespace alias (`Eff.catchAllCause`),
//    and a bare imported `catchAllCause(…)` all report. The name is
//    distinctive enough that a same-named method on an unrelated object
//    would be surprising; a project with one adds a namespace test here.
//
// 4. Registration:
//    Add the rule to the project's oxlint plugin
//    (`rules: { "no-effect-catchallcause": noEffectCatchAllCauseRule }`)
//    and turn it on in `.oxlintrc.json`
//    (`"<plugin>/no-effect-catchallcause": "error"`).
//
// ──────────────────────────────────────────────────────────────────────

import { defineRule, type ESTree } from "@oxlint/plugins";
import { isArchitectureExemptPath } from "../lib/architecture-exempt-paths.ts";

// Keyed by `string` on purpose: every lookup is a member name read off the AST, so a map narrowed
// to its own two keys would refuse the only argument it is ever given. The VALUE side stays a
// literal union, which is what ties each entry to a `meta.messages` key.
const CAUSE_CATCH_METHODS = new Map<string, "causeCaught" | "defectCaught">([
  ["catchAllCause", "causeCaught"],
  ["catchAllDefect", "defectCaught"],
]);

/** The property name when it is statically known — `x.name` or `x["name"]`, never `x[expr]`. */
function staticPropertyName(node: ESTree.MemberExpression): string | null {
  if (!node.computed) return node.property.type === "Identifier" ? node.property.name : null;
  return node.property.type === "Literal" && typeof node.property.value === "string"
    ? node.property.value
    : null;
}

export const noEffectCatchAllCauseRule = defineRule({
  meta: {
    type: "problem",
    messages: {
      causeCaught:
        "Effect.catchAllCause catches defects as well as declared errors, so a bug is handled like an expected failure and the program continues in the state that produced it. Catch the declared errors with Effect.catchTag or Effect.catchAll and let defects reach the runtime boundary.",
      defectCaught:
        "Effect.catchAllDefect turns a bug into a handled value, so the fiber survives the condition that should have ended it. Let the defect reach the runtime boundary, where one supervisor logs the cause — and if a specific defect is genuinely expected, make it a declared error instead.",
    },
  },
  create(context) {
    if (isArchitectureExemptPath(context.filename)) return {};

    return {
      // The member reference, not the call: data-last usage inside a `.pipe(…)` passes the function
      // without calling it, so a CallExpression visitor sees nothing there.
      MemberExpression(node) {
        const name = staticPropertyName(node);
        const messageId = name === null ? undefined : CAUSE_CATCH_METHODS.get(name);
        if (messageId !== undefined) context.report({ node, messageId });
      },

      // The same function imported by name has no member expression to match.
      CallExpression(node) {
        const { callee } = node;
        if (callee.type !== "Identifier") return;
        const messageId = CAUSE_CATCH_METHODS.get(callee.name);
        if (messageId !== undefined) context.report({ node, messageId });
      },
    };
  },
});
