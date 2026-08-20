// ─── effect/no-service-option ─────────────────────────────────────────
//
// Makes sure: Every service a program uses stays in its requirements type.
// Delete a layer from a composition, or forget one in a new environment,
// and the compiler names the missing service where the layers compose. You
// not learn it later from a feature that runs, takes the `None` path, and
// does nothing.
//
// `Effect.serviceOptional` is a different API and stays out of the set. It
// fails with `NoSuchElementException`, so an absent service is still an
// error. Add it only if the project wants that absence to be a compile
// error rather than a runtime one.
//
// A dependency that may legitimately be absent — a metrics sink, a feature
// flag source — keeps its requirement and gets a no-op layer as its
// implementation. The choice then sits in layer composition, where a
// reader sees it. Say this the first time the rule reports, or the rule
// reads as an obstacle and someone turns it off.
//
// The name is matched without a namespace test, so `Effect.serviceOption`,
// a namespace alias, and a bare imported `serviceOption(…)` all report. An
// aliased import reports nothing; this tier has no scope resolution.
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

const OPTIONAL_SERVICE_ACCESSORS = new Set(["serviceOption"]);

/** The property name when it is statically known — `x.name` or `x["name"]`, never `x[expr]`. */
function staticPropertyName(node: ESTree.MemberExpression): string | null {
  if (!node.computed) return node.property.type === "Identifier" ? node.property.name : null;
  return node.property.type === "Literal" && typeof node.property.value === "string"
    ? node.property.value
    : null;
}

export const noServiceOptionRule = defineTreeRule({
  meta: {
    type: "problem",
    messages: {
      optionalService:
        "Effect.serviceOption moves a missing service from a compile-time requirement to a runtime None, so an unwired layer becomes a feature that silently does nothing. Yield the service directly and provide it in the layer that composes this effect — including a stub layer in tests.",
    },
  },
  create(context) {

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
