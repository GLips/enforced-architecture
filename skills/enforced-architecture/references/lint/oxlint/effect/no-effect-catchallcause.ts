// ─── effect/no-effect-catchallcause ───────────────────────────────────
//
// Makes sure: A handler only sees the errors that its effect declares —
// no `Effect.catchAllCause`, no `Effect.catchAllDefect`. A thrown
// exception, a broken invariant, or an interruption ends the fiber and
// reaches the runtime, which logs the whole cause. So a bug reports as one
// crash with a stack and a location, and never as a business outcome.
//
// `catchAllDefect` sits in the set with `catchAllCause` because it is the
// next spelling a person writes once the first one reports. Drop it only
// for a real defect-quarantine boundary — a plugin host, a job runner that
// isolates third-party handlers — and keep that boundary in one named
// module rather than the whole tree.
//
// Cause INSPECTION is not the target. `Effect.sandbox`,
// `Effect.tapErrorCause`, `Cause.pretty`, and an `Effect.catchSomeCause`
// that narrows to one known defect all read the cause and leave it in
// place. Add them to the set and the rule reports correct code.
//
// The member name is matched without a namespace test, so
// `Effect.catchAllCause`, a namespace alias, and a bare imported
// `catchAllCause(…)` all report. An aliased import
// (`import { catchAllCause as recover }`) reports nothing; this tier has
// no scope resolution.
// ──────────────────────────────────────────────────────────────────────

import { defineRule, type ESTree } from "@oxlint/plugins";
import { classifyFileRole } from "../../policy/declared-trees.ts";

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
    if (classifyFileRole(context.filename) === undefined) return {};

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
