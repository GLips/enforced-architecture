// ─── health/no-nested-ternary ────────────────────────────────────────
//
// Tag:      health
// Mechanism: oxlint JS plugin (per-file, real-time)
// Blocking: Yes
//
// Prevents: Double-nested ternary expressions (three levels of
//           conditional). Single ternaries are fine and idiomatic.
//           Nested ternaries (a ? b : c ? d : e) are tolerable.
//           Double-nested ternaries (a ? b : c ? d : e ? f : g)
//           become unreadable and should be extracted to variables,
//           helper functions, or early returns.
//
// Applies:  All .tsx and .ts files EXCEPT:
//           - Test files and scripts
//
// Error:    "Avoid double-nested ternary expressions (three
//            conditionals). Use if/else or extracted variables for
//            clarity."
//
// ── Adapt ─────────────────────────────────────────────────────────────
//
// 1. Nesting depth — `MAX_TERNARY_DEPTH`:
//    This template flags THREE levels of ternary nesting (two levels
//    deep). Set it to 1 for stricter enforcement (any nesting at all,
//    which is what ESLint's no-nested-ternary does), or higher for a
//    more permissive project.
//
// 2. File scope — `isArchitectureExemptPath`:
//    Tests and scripts are exempt through `../lib/architecture-exempt-paths.ts`;
//    edit the patterns there and every rule in the catalog inherits the
//    change. To enforce this only in JSX files, also gate on
//    `isComponentFile(filename)` from the same module.
//
// 3. Registration:
//    Add the rule to the project's oxlint plugin
//    (`rules: { "no-nested-ternary": noNestedTernaryRule }`) and turn it
//    on in `.oxlintrc.json` (`"<plugin>/no-nested-ternary": "error"`).
//
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
