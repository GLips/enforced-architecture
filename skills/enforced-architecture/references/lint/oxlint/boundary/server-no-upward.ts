// ─── boundary/server-no-upward ───────────────────────────────────────
//
// Makes sure: No file under src/infrastructure/ imports `@/features`,
// `@/domains` or `@/routes`. You move src/infrastructure/ into a worker, a
// script or a package, and no feature code comes with it. You change a feature,
// and no infrastructure module changes, because infrastructure reads no feature.
//
// Infrastructure imports infrastructure freely, and reaches down to `@/shared`
// and `@/env`. This rule says nothing about those edges, and a project that
// wants to restrict them needs a separate rule.
//
// A relative specifier reaches the same module and no pattern here sees it.
// Adopt boundary/import-policy in the structural tier with this rule.
//
// A bare `@/features` names no unit, so there is no area to compare and this
// rule is silent. `arch/import-policy` reports that specifier as an unclassified
// target, which is the finding that edge gets — in the OXLINT tier only. The
// structural check skips aliased specifiers by design, because the linter sees
// them without resolving anything.
//
// SCOPE, and it is the same for every rule in this catalog: this rule is silent
// outside the declared trees, and silent on the files `isArchitectureExemptPath`
// names inside them — tests, scripts, generated and ambient modules. Neither
// silence is coverage. `lib/define-tree-rule.ts` owns both, which is why no rule
// body checks either one.
// ──────────────────────────────────────────────────────────────────────

import { defineTreeRule } from "../lib/define-tree-rule.ts";
import { classifySpecifier, classifyTargetPath, type TargetArea } from "../../policy/layout.ts";
import { visitModuleSources } from "../lib/module-source-visitor.ts";

/**
 * The areas that sit ABOVE an adapter. Named as areas rather than as an
 * `@/(features|domains|routes)` regex, so a tree that renames any of the three
 * keeps the same fence — a regex spelling a directory this rule does not own is
 * a rule that goes quiet on a rename rather than one that errors.
 */
const UPPER_AREAS: TargetArea[] = ["feature", "domain", "route"];

export const serverNoUpwardRule = defineTreeRule({
  meta: {
    type: "problem",
    messages: {
      infraImportsUpperLayer:
        "Infrastructure modules cannot import from features, domains, or routes. Infrastructure provides services to upper layers — it does not consume them. If this module needs feature-specific behavior, accept it as a parameter.",
    },
  },
  create(context, role) {
    if (role.place?.profile !== "infrastructure") return {};
    const { vocabulary } = role.tree;

    return visitModuleSources((source, specifier) => {
      const target = classifySpecifier(vocabulary, specifier);
      if (target?.kind !== "module") return;
      const to = classifyTargetPath(vocabulary, target.path);
      if (to !== undefined && UPPER_AREAS.includes(to.area)) {
        context.report({ node: source, messageId: "infraImportsUpperLayer" });
      }
    });
  },
});
