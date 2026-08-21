// ─── boundary/db-isolation ────────────────────────────────────────────
//
// Makes sure: `@/infrastructure/db` is imported only from infrastructure/,
// features/*/repo/ and features/*/controllers/. To add a tenant filter to every
// query, or to find each caller of a table, you read three directories. A UI
// file cannot reach the database client, so the build puts no database driver in
// the browser bundle.
//
// The DB alias comes from the resolved tree's `dbDir` and alias prefix, which is
// also where boundary/layer-occupancy reads the schema path. A project with a
// flat `@/db` moves the directory THERE and both rules follow. A path written
// out again here is how the two rules end up with different paths.
//
// A raw ORM or driver package is not matched here. Containment of a package is
// boundary/sdk-containment's question, and its owner rows answer it.
//
// A relative specifier reaches the same module and no pattern here sees it.
// Adopt boundary/import-policy in the structural tier with this rule.
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
import { isAtProfile } from "../../policy/declared-trees.ts";
import {
  aliasSpecifierFor,
  isUnderPath,
  type SourceProfile,
  dbDir,
} from "../../policy/layout.ts";
import { visitModuleSources } from "../lib/module-source-visitor.ts";

/**
 * The positions the database may be named from. Profiles rather than path
 * regexes, so a sibling directory that merely ends in the same word —
 * `features/x/legacy-repo/`, a package called `infrastructure-utils` — cannot
 * inherit the exemption, and a tree that renames a layer keeps it.
 */
const DATA_ACCESS_PROFILES: SourceProfile[] = [
  "infrastructure",
  "feature-repo",
  "feature-controllers",
];

export const dbIsolationRule = defineTreeRule({
  meta: {
    type: "problem",
    messages: {
      dbOutsideDataLayer:
        "DB client/schema imports are restricted to {{infrastructureDir}}/*, {{featuresDir}}/*/{{repoLayer}}/*, and {{featuresDir}}/*/{{controllersLayer}}/*. Move this DB access to a {{repoLayer}} or {{controllersLayer}} module.",
    },
  },
  create(context, role) {
    // The ORM config file needs no exemption of its own: it sits at the project
    // root, outside every declared tree, so this rule is already silent there.
    // That is the same reason `vite.config.ts` and `tailwind.config.ts` need none.
    if (isAtProfile(role, ...DATA_ACCESS_PROFILES)) return {};

    const { vocabulary } = role.tree;
    const dbAlias = aliasSpecifierFor(vocabulary, dbDir(vocabulary));

    return visitModuleSources((source, specifier) => {
      // Whole segments: `@/infrastructure/db` and anything under it, and never
      // `@/infrastructure/db-legacy`.
      if (isUnderPath(specifier, dbAlias)) {
        context.report({
          node: source,
          messageId: "dbOutsideDataLayer",
          data: {
            infrastructureDir: vocabulary.infrastructureDir,
            featuresDir: vocabulary.featuresDir,
            repoLayer: vocabulary.featureLayerDirs.repo,
            controllersLayer: vocabulary.featureLayerDirs.controllers,
          },
        });
      }
    });
  },
});
