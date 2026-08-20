// ─── placement/no-deprecated-input-validator ──────────────────────────
//
// Makes sure: Server functions and middleware use one spelling, `.validator()`.
// The rename covers the whole tree and not the files someone opened, thus a
// search for `.validator(` finds every checked chain. You read one method name,
// not two, to know whether a handler checks its input.
//
// Both builders share the deprecation. A rule that names createServerFn alone
// leaves middleware on the old method, and middleware checks a request before
// the handler runs.
//
// The method name alone does not identify the builder. Require a mention of
// createServerFn or createMiddleware inside the receiver, or an unrelated
// object with an `.inputValidator()` method of its own gets a report it cannot
// act on.
//
// A chain still on `.inputValidator()` also reports at
// placement/server-fn-validation, which reads the name `.validator()` and no
// other. The two rules agree by design.
//
// The deprecation is in @tanstack/start-plugin-core/src/start-compiler/,
// handleCreateServerFn.ts and handleCreateMiddleware.ts.
// ──────────────────────────────────────────────────────────────────────

import { defineTreeRule } from "../lib/define-tree-rule.ts";
import type { ESTree, Range } from "@oxlint/plugins";
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

export const noDeprecatedInputValidatorRule = defineTreeRule({
  meta: {
    type: "problem",
    messages: {
      deprecatedInputValidator:
        ".inputValidator() is deprecated in TanStack Start. Use .validator() instead.",
    },
  },
  create(context) {

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
