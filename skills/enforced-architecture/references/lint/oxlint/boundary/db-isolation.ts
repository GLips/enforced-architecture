// ─── boundary/db-isolation ────────────────────────────────────────────
//
// Tag:       boundary
// Mechanism: oxlint JS plugin (per-file, real-time)
// Blocking:  Yes
//
// Prevents: Code outside the data-access layers importing database
//           modules directly, bypassing the repo or controller layer.
//           This is the single most important boundary rule — it
//           enforces that all DB access flows through designated layers.
//
// Applies:  All src/** files EXCEPT:
//           - infrastructure/** (IS the DB layer)
//           - features/*/repo/** (designated DB access layer)
//           - features/*/controllers/** (when no repo layer exists)
//           - ORM config files (drizzle.config.ts)
//           - Test files and scripts
//
// Error:    "DB client/schema imports are restricted to
//            infrastructure/*, features/*/repo/*, and
//            features/*/controllers/*. Move this DB access
//            to a repo or controller module."
//
// ── Adapt ─────────────────────────────────────────────────────────────
//
// 1. Who is allowed DB access — the `ALLOWED_LAYERS` patterns:
//    Add or remove layers that are permitted DB access in the project.
//    If the project has no repo/ layer, controllers/ is the DB boundary.
//    If the project uses a service/ layer for DB access, add it here.
//
// 2. What counts as a DB import:
//    Nothing here — `DB_ALIAS` is built from `DB_DIR` and the alias
//    prefix in `lint/policy/layout.ts`, which is also where
//    `boundary/layer-occupancy` reads the schema path from. A project
//    with a flat `@/db` moves the directory THERE and both rules follow;
//    restating it here is how the two end up fencing different paths.
//    Matched as a prefix rather than a regex so a path segment
//    containing a `.` needs no escaping.
//
//    Raw ORM/driver packages are a separate question and deliberately
//    not matched here: containment of a package belongs to
//    `boundary/sdk-containment` and its owner rows.
//
// 3. Registration:
//    Add the rule to the project's oxlint plugin
//    (`rules: { "db-isolation": dbIsolationRule }`) and turn it on in
//    `.oxlintrc.json` (`"<plugin>/db-isolation": "error"`).
//
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
