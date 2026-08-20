// ─── health/no-nested-ternary ────────────────────────────────────────
//
// Makes sure: No expression selects a result behind more than two conditions.
// To add a case to a decision, you edit an `if` block or a named variable. You
// do not count the `?` and `:` marks of a chain to find the place for the new
// case. A case put after the wrong `:` compiles and returns a wrong value for
// the cases around it.
//
// `MAX_TERNARY_DEPTH` is 2, thus a single ternary and one nested ternary both
// pass. A value of 1 reports `a ? b : c ? d : e`, which is a common and exact
// shape. A rule that reports the code a team writes every day is a rule the
// team disables, and the deep chains then stay too.
//
// Do not gate this rule on `isComponentFile`. A JSX attribute holds many of
// these chains, but the same chain in a `.ts` file is as hard to read. That
// gate makes the rule silent on every file that is not `.tsx`.
// ──────────────────────────────────────────────────────────────────────

import { defineRule, type ESTree, type Range } from "@oxlint/plugins";
import { isArchitectureExemptPath } from "../lib/architecture-exempt-paths.ts";

const MAX_TERNARY_DEPTH = 2;

// Depth counts conditionals in the BRANCHES, not in the test: a ternary in a condition is a
// separate decision that happens to be spelled inline, not a nested outcome.
function isInsideBranch(inner: Range, outer: ESTree.ConditionalExpression): boolean {
  const branches: Range[] = [outer.consequent.range, outer.alternate.range];
  return branches.some(([start, end]) => inner[0] >= start && inner[1] <= end);
}

export const noNestedTernaryRule = defineRule({
  meta: {
    type: "problem",
    messages: {
      deeplyNested:
        "Avoid double-nested ternary expressions (three conditionals). Use if/else or extracted variables for clarity.",
    },
  },
  create(context) {
    if (isArchitectureExemptPath(context.filename)) return {};

    const conditionals: ESTree.ConditionalExpression[] = [];
    const depths = new Map<ESTree.ConditionalExpression, number>();

    function depthOf(node: ESTree.ConditionalExpression): number {
      const memo = depths.get(node);
      if (memo !== undefined) return memo;
      let depth = 1;
      for (const other of conditionals) {
        if (other !== node && isInsideBranch(other.range, node)) {
          depth = Math.max(depth, 1 + depthOf(other));
        }
      }
      depths.set(node, depth);
      return depth;
    }

    return {
      ConditionalExpression(node) {
        conditionals.push(node);
      },

      // Every conditional gets its depth measured, and the measurement asks about the whole
      // subtree. Anything that binds the first nested ternary it finds and stops lets an innocuous
      // shallow ternary earlier in the subtree mask the real chain behind it — that is exactly how
      // two live violations hid from the GritQL version of this rule.
      "Program:exit"() {
        for (const node of conditionals) {
          if (depthOf(node) > MAX_TERNARY_DEPTH) {
            context.report({ node, messageId: "deeplyNested" });
          }
        }
      },
    };
  },
});
