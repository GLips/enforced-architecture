// ─── boundary/route-thinness ─────────────────────────────────────────
//
// Tag:       boundary
// Mechanism: oxlint JS plugin (per-file, real-time)
// Blocking:  Yes
//
// Prevents: Route/transport files importing the database layer or
//           server-only environment configuration directly. Routes
//           must be thin adapters that compose UI and call features
//           through their public API barrels. Direct DB access in
//           routes bypasses auth, validation, and the feature's data
//           access layer. Server env imports leak secrets into the
//           transport layer, which is the most framework-coupled code
//           and rewrites entirely during framework migrations.
//
// Applies:  All src/routes/** files EXCEPT:
//           - Test files
//
// Error:    "Routes must be thin adapters. Import data via feature
//            barrels (@/features/<feature>),
//            not directly from DB or env.server."
//
// ── Adapt ─────────────────────────────────────────────────────────────
//
// 1. Which files are routes — `ROUTE_LAYER`:
//    Adjust to match the project's route/transport directory.
//    Examples:
//      /\/src\/routes\//   — file-based routing (this template)
//      /\/src\/pages\//    — Next.js-style pages directory
//      /\/src\/app\//      — Next.js app router
//      /\/src\/commands\// — CLI command handlers
//    Keep the trailing separator: without it the pattern also claims
//    `src/routes-legacy/`, which is a different directory.
//
// 2. What routes may not reach — `BANNED_SPECIFIERS`:
//    The default bans the DB layer and server-only env. Add further
//    entries for other server-only modules routes should not touch:
//      /^@\/infrastructure\/integrations(?:\/|$)/  — if routes should not use SDKs
//      /^@\/domains(?:\/|$)/                       — if routes must go through features
//    Every entry is anchored at `^` and closed with `(?:\/|$)` so a
//    module whose name merely starts the same way (`@/infrastructure/dbt-logger`)
//    is not swept in.
//
// 3. Registration:
//    Add the rule to the project's oxlint plugin
//    (`rules: { "route-thinness": routeThinnessRule }`) and turn it on in
//    `.oxlintrc.json` (`"<plugin>/route-thinness": "error"`).
//
// ──────────────────────────────────────────────────────────────────────

import { defineRule } from "@oxlint/plugins";
import { isArchitectureExemptPath } from "../lib/architecture-exempt-paths.ts";
import { visitModuleSources } from "../lib/module-source-visitor.ts";

const ROUTE_LAYER = /\/src\/routes\//;

// The message also names `index.server`, which is guidance rather than a third arm here:
// api/server-import-context already fences server barrels out of every client context, routes
// included, and two rules reporting the same specifier trains people to ignore both.
const BANNED_SPECIFIERS = [/^@\/infrastructure\/db(?:\/|$)/, /^@\/env\.server$/];

export const routeThinnessRule = defineRule({
  meta: {
    type: "problem",
    messages: {
      serverOnlyImportInRoute:
        "Routes are isomorphic thin adapters. Import data through the client-safe feature barrel (@/features/<feature>), not DB, env.server, or index.server.",
    },
  },
  create(context) {
    const { filename } = context;
    if (isArchitectureExemptPath(filename) || !ROUTE_LAYER.test(filename)) return {};

    return visitModuleSources((source, specifier) => {
      if (BANNED_SPECIFIERS.some((banned) => banned.test(specifier))) {
        context.report({ node: source, messageId: "serverOnlyImportInRoute" });
      }
    });
  },
});
