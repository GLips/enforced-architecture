// ─── types/no-conditional-empty-object-spread ────────────────────────
//
// Shows: Object literals whose key set depends on a condition inside a spread.
// A reader learns which literals do not state their own keys, and how many
// shapes each one can have — three such spreads in one literal make eight
// shapes. The rule reports; it does not block a commit.
//
// Register it as "warn". Under `exactOptionalPropertyTypes` this idiom is the
// standard way to omit a property rather than set it to `undefined`, and the
// alternatives are worse: several statements that mutate an object, or a
// helper. It is a signal about density, not a defect.
//
// A conditional spread with two real branches stays legal
// (`...(isAdmin ? adminDefaults : userDefaults)`). It chooses between two
// values and hides no absence.
// ──────────────────────────────────────────────────────────────────────

import { defineRule, type ESTree } from "@oxlint/plugins";
import { isArchitectureExemptPath } from "../lib/architecture-exempt-paths.ts";

function isEmptyObjectExpression(node: ESTree.Expression): boolean {
  return node.type === "ObjectExpression" && node.properties.length === 0;
}

export const noConditionalEmptyObjectSpreadRule = defineRule({
  meta: {
    type: "suggestion",
    messages: {
      hiddenOmission:
        "This spread hides whether the property exists behind an empty object, so the literal's own keys are no longer readable. Build the object in named steps and add the property when it is present.",
    },
  },
  create(context) {
    if (isArchitectureExemptPath(context.filename)) return {};

    return {
      SpreadElement(node) {
        // Only inside an object literal. The same shape in an array or a call argument list is a
        // different construct with none of the same readability cost.
        if (node.parent.type !== "ObjectExpression") return;
        const argument = node.argument;
        if (argument.type !== "ConditionalExpression") return;
        // Either branch, because the condition is routinely written negated.
        if (
          isEmptyObjectExpression(argument.consequent) ||
          isEmptyObjectExpression(argument.alternate)
        ) {
          context.report({ node, messageId: "hiddenOmission" });
        }
      },
    };
  },
});
