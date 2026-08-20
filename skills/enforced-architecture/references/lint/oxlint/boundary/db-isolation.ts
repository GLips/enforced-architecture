// ─── boundary/db-isolation ────────────────────────────────────────────
//
// Makes sure: `@/infrastructure/db` is imported only from infrastructure/,
// features/*/repo/ and features/*/controllers/. To add a tenant filter to every
// query, or to find each caller of a table, you read three directories. A UI
// file cannot reach the database client, so the build puts no database driver in
// the browser bundle.
//
// `DB_ALIAS` comes from `DB_DIR` and the alias prefix in lint/policy/layout.ts,
// which is also where boundary/layer-occupancy reads the schema path. A project
// with a flat `@/db` moves the directory THERE and both rules follow. A path
// written out again here is how the two rules end up with different paths.
//
// A raw ORM or driver package is not matched here. Containment of a package is
// boundary/sdk-containment's question, and its owner rows answer it.
//
// A relative specifier reaches the same module and no pattern here sees it.
// Adopt boundary/import-policy in the structural tier with this rule.
// ──────────────────────────────────────────────────────────────────────

import { defineRule } from "@oxlint/plugins";
import { aliasSpecifierFor, DB_DIR } from "../../policy/layout.ts";
import { isArchitectureExemptPath } from "../lib/architecture-exempt-paths.ts";
import { visitModuleSources } from "../lib/module-source-visitor.ts";

const DB_ALIAS = aliasSpecifierFor(DB_DIR);

/** `@/infrastructure/db` and anything under it, and never `@/infrastructure/db-legacy`. */
function isDbSpecifier(specifier: string): boolean {
  return specifier === DB_ALIAS || specifier.startsWith(`${DB_ALIAS}/`);
}

// Anchored on `/src/` so a sibling directory that merely ends in the same word — `src/legacy-repo/`,
// a package called `infrastructure-utils` — does not inherit the exemption.
const ALLOWED_LAYERS = [
  /\/src\/infrastructure\//,
  /\/src\/features\/[^/]+\/repo\//,
  /\/src\/features\/[^/]+\/controllers\//,
];
const ORM_CONFIG = /\/drizzle\.config\.[tj]s$/;

export const dbIsolationRule = defineRule({
  meta: {
    type: "problem",
    messages: {
      dbOutsideDataLayer:
        "DB client/schema imports are restricted to infrastructure/*, features/*/repo/*, and features/*/controllers/*. Move this DB access to a repo or controller module.",
    },
  },
  create(context) {
    const { filename } = context;
    if (isArchitectureExemptPath(filename) || ORM_CONFIG.test(filename)) return {};
    if (ALLOWED_LAYERS.some((layer) => layer.test(filename))) return {};

    return visitModuleSources((source, specifier) => {
      if (isDbSpecifier(specifier)) {
        context.report({ node: source, messageId: "dbOutsideDataLayer" });
      }
    });
  },
});
