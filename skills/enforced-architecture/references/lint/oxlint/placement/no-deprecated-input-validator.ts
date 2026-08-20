// ─── placement/no-deprecated-input-validator ──────────────────────────
//
// Tag:       placement
// Mechanism: oxlint JS plugin (per-file, real-time)
// Blocking:  Yes
//
// Prevents: Deprecated `.inputValidator()` calls on TanStack Start server
//           functions and middleware. Use `.validator()` instead.
//
// Applies:  All src/** files except tests and scripts.
//
// Error:    ".inputValidator() is deprecated in TanStack Start. Use
//            .validator() instead."
//
// Source: @tanstack/start-plugin-core/src/start-compiler/handleCreateServerFn.ts
//         and handleCreateMiddleware.ts.
//
// ── Adapt ─────────────────────────────────────────────────────────────
//
// 1. `DEPRECATED_METHOD` — the builder method that was renamed.
//    Point it at whatever method the framework retired; the message
//    must name the replacement, since the message IS the fix.
//
// 2. `BUILDER_FACTORIES` — whose builder this method belongs to:
//    Both TanStack Start builders share the deprecation, so both are
//    listed. The set is what keeps an unrelated object that happens to
//    expose `.inputValidator()` out of the diagnostic — a bare method
//    name is not enough to identify a builder.
//
// 3. Registration:
//    Add the rule to the project's oxlint plugin
//    (`rules: { "no-deprecated-input-validator": noDeprecatedInputValidatorRule }`)
//    and turn it on in `.oxlintrc.json`
//    (`"<plugin>/no-deprecated-input-validator": "error"`).
//
// ──────────────────────────────────────────────────────────────────────

import type { ESTree, Range } from "@oxlint/plugins";
import { defineRule } from "@oxlint/plugins";
import { isArchitectureExemptPath } from "../lib/architecture-exempt-paths.ts";
import { createRangeIndex } from "../lib/range-index.ts";

const DEPRECATED_METHOD = "inputValidator";
const BUILDER_FACTORIES = new Set(["createServerFn", "createMiddleware"]);
const FACTORY_MENTION = "builder-factory";

/** The method name, whether spelled `x.inputValidator()` or `x["inputValidator"]()`. */
function calledMethodName(callee: ESTree.Expression): string | null {
  if (callee.type !== "MemberExpression") return null;
  if (!callee.computed) {
    return callee.property.type === "Identifier" ? callee.property.name : null;
  }
  return callee.property.type === "Literal" && typeof callee.property.value === "string"
    ? callee.property.value
    : null;
}

export const noDeprecatedInputValidatorRule = defineRule({
  meta: {
    type: "problem",
    messages: {
      deprecatedInputValidator:
        ".inputValidator() is deprecated in TanStack Start. Use .validator() instead.",
    },
  },
  create(context) {
    const { filename } = context;
    if (isArchitectureExemptPath(filename)) return {};

    // The builder is whatever the method is called ON, and the factory can sit arbitrarily deep
    // inside it — `createServerFn().middleware([auth]).inputValidator(…)`. A visitor reaches the
    // receiver only AFTER the call it belongs to, so the containment question is answerable at
    // Program:exit and nowhere earlier.
    const factoryMentions = createRangeIndex();
    const deprecatedCalls: { node: ESTree.CallExpression; receiver: Range }[] = [];

    return {
      // The mention, not the call: `start.createServerFn()` and a re-wrapped factory both name it.
      Identifier(node) {
        if (BUILDER_FACTORIES.has(node.name)) factoryMentions.record(FACTORY_MENTION, node.range);
      },
      CallExpression(node) {
        if (calledMethodName(node.callee) !== DEPRECATED_METHOD) return;
        const receiver = (node.callee as ESTree.MemberExpression).object;
        deprecatedCalls.push({ node, receiver: receiver.range });
      },
      "Program:exit"() {
        for (const { node, receiver } of deprecatedCalls) {
          if (factoryMentions.containedIn(FACTORY_MENTION, receiver)) {
            context.report({ node, messageId: "deprecatedInputValidator" });
          }
        }
      },
    };
  },
});
