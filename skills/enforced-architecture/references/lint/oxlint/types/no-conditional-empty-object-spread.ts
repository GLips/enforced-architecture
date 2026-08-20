// ─── types/no-conditional-empty-object-spread ────────────────────────
//
// Tag:      types
// Mechanism: oxlint JS plugin (per-file, real-time)
// Blocking: No — register as "warn". See Adapt note 1 before adopting.
//
// Prevents: Property omission hidden inside a spread:
//
//             const options = {
//               ...(timeout !== undefined ? { timeout } : {}),
//             };
//
//           The `{}` is doing invisible work. Reading the object
//           literal tells you nothing about which keys it has — that
//           depends on a condition buried inside a spread, and the
//           resulting type is a union the reader has to compute. Stack
//           three of these in one literal and the set of possible
//           shapes is eight.
//
//           It is also the shape an agent produces when it wants to
//           satisfy `exactOptionalPropertyTypes` and does not want to
//           restructure the code, which is why it clusters in generated
//           config-building.
//
// Excludes: Conditional spreads with two real branches
//           (`...(isAdmin ? adminDefaults : userDefaults)`), which
//           choose between things rather than hiding an absence.
//
// Applies:  All .ts and .tsx files EXCEPT:
//           - Test files and scripts
//
// Error:    "This spread hides whether the property exists behind an
//            empty object, so the literal's own keys are no longer
//            readable. Build the object in named steps and add the
//            property when it is present."
//
// ── Adapt ─────────────────────────────────────────────────────────────
//
// 1. This is the most arguable rule in the catalog — read before taking:
//    Under `exactOptionalPropertyTypes`, this idiom is the standard way
//    to omit rather than set-to-undefined, and the alternatives are
//    genuinely worse: a mutable object built over several statements,
//    or a helper. Reasonable codebases use it deliberately. It ships
//    NON-BLOCKING for that reason — as a signal about density, not a
//    defect. Take it if generated config objects are drifting toward
//    unreadable; skip it if the idiom is a considered house style.
//
// 2. Tightening it — a count threshold:
//    One conditional spread is readable; four in one literal is not.
//    Reporting only when a single ObjectExpression contains more than
//    N of them targets the real damage and drops nearly all the noise.
//    That is the version to reach for if this rule is too loud, and it
//    is a better rule than the one implemented here for most projects.
//
// 3. Registration:
//    Add the rule to the project's oxlint plugin
//    (`rules: { "no-conditional-empty-object-spread": noConditionalEmptyObjectSpreadRule }`)
//    and turn it on in `.oxlintrc.json` as
//    (`"<plugin>/no-conditional-empty-object-spread": "warn"`).
//
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
