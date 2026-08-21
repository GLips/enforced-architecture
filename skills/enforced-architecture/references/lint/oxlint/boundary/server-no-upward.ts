// ─── boundary/server-no-upward ───────────────────────────────────────
//
// Makes sure: No file in a tree's infrastructure layer imports a feature, a
// domain or a route — `@/features`, `@/domains` and `@/routes` in the default
// vocabulary. You move the infrastructure layer into a worker, a script or a
// package, and no feature code comes with it. You change a feature, and no
// infrastructure module changes, because infrastructure reads no feature.
//
// Infrastructure imports infrastructure freely, and reaches down to the shared
// layer and the env modules. This rule says nothing about those edges, and a
// project that wants to restrict them needs a separate rule.
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
// SCOPE, and it is the same for every TREE-SCOPED rule in this catalog — which
// is every rule but `testing/no-module-mocking`, whose subject is a test file and
// which is therefore enabled globally. This rule is silent outside the declared
// trees, and silent on the files `isArchitectureExemptSourcePath` names inside
// them — tests, scripts, generated and ambient modules. Neither
// silence is coverage. `lib/define-tree-rule.ts` owns both, which is why no rule
// body checks either one.
// ──────────────────────────────────────────────────────────────────────

import { defineTreeRule } from "../lib/define-tree-rule.ts";
import {
  aliasSpecifierFor,
  classifySpecifier,
  classifyTargetPath,
  type TargetArea,
  type TreeVocabulary,
} from "../../policy/layout.ts";
import { visitModuleSources } from "../lib/module-source-visitor.ts";

/**
 * The areas that sit ABOVE an adapter, and how the reporting tree spells each.
 * Keyed by area rather than written as an `@/(features|domains|routes)` regex,
 * so a tree that renames any of the three keeps the same fence — a regex
 * spelling a directory this rule does not own is a rule that goes quiet on a
 * rename rather than one that errors.
 *
 * The fence is the KEY SET and the message is the values, from one record on
 * purpose. Held apart, a fourth upper area is added to the list the rule tests
 * and left out of the sentence the reader acts on, and the message that names
 * two of three directories reads exactly like the one that names all of them.
 */
const UPPER_AREA_DIRS: Record<
  Extract<TargetArea, "feature" | "domain" | "route">,
  (vocabulary: TreeVocabulary) => string
> = {
  feature: (vocabulary) => vocabulary.featuresDir,
  domain: (vocabulary) => vocabulary.domainsDir,
  route: (vocabulary) => vocabulary.routesDir,
};

// The cast is over the KEYS only — widening to `TargetArea[]` is what
// `.includes(to.area)` needs and follows on its own.
const UPPER_AREAS: TargetArea[] = Object.keys(UPPER_AREA_DIRS) as (keyof typeof UPPER_AREA_DIRS)[];

/**
 * The directories the message names, in the REPORTING tree's own spelling.
 *
 * The upper areas are spelled as specifiers, because what the reader is being
 * told not to write is an import — a bare `features` is a directory they then
 * have to locate, while `@/features` is the string in the line under the caret.
 *
 * Exported for its spec, and that is load-bearing rather than convenience.
 * `DECLARED_TREES` holds one tree, spelled exactly as `RECOMMENDED_VOCABULARY`
 * spells it, so a message frozen back to a literal `features, domains, or
 * routes` renders text every fixture beside it still accepts. Rendering under a
 * SECOND vocabulary is the only assertion that separates deriving from having
 * been written down correctly once, and a rule spec has no way to declare a
 * second tree.
 */
export function infraImportsUpperLayerMessageData(vocabulary: TreeVocabulary): {
  infrastructureDir: string;
  upperAreas: string;
} {
  return {
    infrastructureDir: vocabulary.infrastructureDir,
    upperAreas: Object.values(UPPER_AREA_DIRS)
      .map((dirOf) => aliasSpecifierFor(vocabulary, dirOf(vocabulary)))
      .join(", "),
  };
}

export const serverNoUpwardRule = defineTreeRule({
  meta: {
    type: "problem",
    messages: {
      infraImportsUpperLayer:
        "A module in {{infrastructureDir}}/ cannot import from {{upperAreas}}. The {{infrastructureDir}}/ layer provides services to the layers above it — it does not consume them. If this module needs feature-specific behavior, accept it as a parameter.",
    },
  },
  create(context, role) {
    if (role.place?.profile !== "infrastructure") return {};
    const { vocabulary } = role.tree;
    const data = infraImportsUpperLayerMessageData(vocabulary);

    return visitModuleSources((source, specifier) => {
      const target = classifySpecifier(vocabulary, specifier);
      if (target?.kind !== "module") return;
      const to = classifyTargetPath(vocabulary, target.path);
      if (to !== undefined && UPPER_AREAS.includes(to.area)) {
        context.report({ node: source, messageId: "infraImportsUpperLayer", data });
      }
    });
  },
});
