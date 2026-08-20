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
// ──────────────────────────────────────────────────────────────────────

import { defineRule } from "@oxlint/plugins";
import { isArchitectureExemptPath } from "../lib/architecture-exempt-paths.ts";
import { visitModuleSources } from "../lib/module-source-visitor.ts";

const INFRASTRUCTURE_LAYER = /\/src\/infrastructure\//;
const UPPER_LAYER_SPECIFIER = /^@\/(?:features|domains|routes)(?:\/|$)/;

export const serverNoUpwardRule = defineRule({
  meta: {
    type: "problem",
    messages: {
      infraImportsUpperLayer:
        "Infrastructure modules cannot import from features, domains, or routes. Infrastructure provides services to upper layers — it does not consume them. If this module needs feature-specific behavior, accept it as a parameter.",
    },
  },
  create(context) {
    const { filename } = context;
    if (!INFRASTRUCTURE_LAYER.test(filename) || isArchitectureExemptPath(filename)) return {};

    return visitModuleSources((source, specifier) => {
      if (UPPER_LAYER_SPECIFIER.test(specifier)) {
        context.report({ node: source, messageId: "infraImportsUpperLayer" });
      }
    });
  },
});
