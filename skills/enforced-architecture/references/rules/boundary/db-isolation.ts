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
// 2. What counts as a DB import — `DB_SPECIFIER`:
//    Adjust to match the project's DB module import path.
//    Examples:
//      @/infrastructure/db  — layered infrastructure (this template)
//      @/db                 — flat top-level db directory
//    Add the raw ORM/driver packages to catch imports that skip the
//    wrapper entirely: /^drizzle-orm(?:\/|$)|^pg$|^postgres$/.
//
// 3. Registration:
//    Add the rule to the project's oxlint plugin
//    (`rules: { "db-isolation": dbIsolationRule }`) and turn it on in
//    `.oxlintrc.json` (`"<plugin>/db-isolation": "error"`).
//
// ──────────────────────────────────────────────────────────────────────

import { defineRule } from "@oxlint/plugins";
import { isArchitectureExemptPath } from "../lib/architecture-exempt-paths.ts";
import { visitModuleSources } from "../lib/module-source-visitor.ts";

const DB_SPECIFIER = /^@\/infrastructure\/db(?:\/|$)/;

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
      if (DB_SPECIFIER.test(specifier)) {
        context.report({ node: source, messageId: "dbOutsideDataLayer" });
      }
    });
  },
});
