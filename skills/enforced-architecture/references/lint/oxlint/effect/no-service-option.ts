// ─── effect/no-service-option ─────────────────────────────────────────
//
// Tag:       effect
// Mechanism: oxlint JS plugin (per-file, real-time)
// Blocking:  Yes
//
// Prevents: `Effect.serviceOption`, which takes a service out of the
//           requirements type and hands back an `Option` instead.
//
//           The requirement is the mechanism. A service in `R` means the
//           program does not compile until some layer provides it, and
//           that is a failure at wiring time, in one place, before the
//           process serves anything. `serviceOption` converts it into a
//           runtime `Option`: the missing layer stops being an error and
//           becomes a branch, so the feature silently does nothing in
//           whichever environment forgot to wire it — and reads as
//           working, because the `None` path was written to be quiet.
//
//           Yield the service (`const db = yield* Database`) and provide
//           it in the layer that composes this effect. Tests get a stub
//           layer, which is the substitute for the service, not a reason
//           to make the service optional.
//
// Applies:  All .ts and .tsx files EXCEPT test files and scripts.
//
// Error:    "Effect.serviceOption moves a missing service from a
//            compile-time requirement to a runtime None, so an unwired
//            layer becomes a feature that silently does nothing. Yield
//            the service directly and provide it in the layer that
//            composes this effect — including a stub layer in tests."
//
// Negative space: `Effect.serviceOptional` is a different API — it fails
//                 with NoSuchElementException rather than returning an
//                 Option, so the absence is still an error — and is left
//                 alone. An aliased import is not tracked; this tier has
//                 no scope resolution.
//
// ── Adapt ─────────────────────────────────────────────────────────────
//
// 1. What is banned — `OPTIONAL_SERVICE_ACCESSORS`:
//    One name, matched exactly, so the neighbouring `serviceOptional`
//    stays legal. Add `serviceOptional` too only if the project wants
//    every absent-service path to be a wiring error rather than a
//    runtime one.
//
// 2. The genuinely optional dependency has a different shape.
//    A service that may legitimately be absent (a metrics sink, a feature
//    flag source) is modelled as a service whose *implementation* is a
//    no-op layer, not as an optional lookup — the requirement stays in
//    the type and the choice moves to layer composition, where it is
//    visible. That is the fix this rule is pushing toward, and it is
//    worth saying out loud in review the first time the rule fires.
//
// 3. The member name is matched without checking the namespace, so
//    `Effect.serviceOption`, a namespace alias, and a bare imported
//    `serviceOption(…)` all report.
//
// 4. Registration:
//    Add the rule to the project's oxlint plugin
//    (`rules: { "no-service-option": noServiceOptionRule }`) and turn it
//    on in `.oxlintrc.json`
//    (`"<plugin>/no-service-option": "error"`).
//
// ──────────────────────────────────────────────────────────────────────

import { defineRule, type ESTree } from "@oxlint/plugins";
import { isArchitectureExemptPath } from "../lib/architecture-exempt-paths.ts";

const OPTIONAL_SERVICE_ACCESSORS = new Set(["serviceOption"]);

/** The property name when it is statically known — `x.name` or `x["name"]`, never `x[expr]`. */
function staticPropertyName(node: ESTree.MemberExpression): string | null {
  if (!node.computed) return node.property.type === "Identifier" ? node.property.name : null;
  return node.property.type === "Literal" && typeof node.property.value === "string"
    ? node.property.value
    : null;
}

export const noServiceOptionRule = defineRule({
  meta: {
    type: "problem",
    messages: {
      optionalService:
        "Effect.serviceOption moves a missing service from a compile-time requirement to a runtime None, so an unwired layer becomes a feature that silently does nothing. Yield the service directly and provide it in the layer that composes this effect — including a stub layer in tests.",
    },
  },
  create(context) {
    if (isArchitectureExemptPath(context.filename)) return {};

    return {
      // The member reference rather than the call, so a data-last use inside `.pipe(…)` — which
      // passes the function without calling it — is matched by the same branch.
      MemberExpression(node) {
        const name = staticPropertyName(node);
        if (name !== null && OPTIONAL_SERVICE_ACCESSORS.has(name)) {
          context.report({ node, messageId: "optionalService" });
        }
      },

      CallExpression(node) {
        const { callee } = node;
        if (callee.type === "Identifier" && OPTIONAL_SERVICE_ACCESSORS.has(callee.name)) {
          context.report({ node, messageId: "optionalService" });
        }
      },
    };
  },
});
