// ─── boundary/route-thinness ─────────────────────────────────────────
//
// Makes sure: No file in src/routes/ imports the database layer or
// `@/env.server`. A route file runs in the browser too, so that env import puts
// a secret in the browser bundle. To find a query you read features/, and a
// framework migration rewrites src/routes/ with no data access to move.
//
// Not here: `*/index.server` in a route. api/server-import-context owns it, and
// owns it with a distinction this rule cannot make: a route file named
// `*.server.ts` is a server context and MAY import a server barrel, while
// `routes/invoices.tsx` may not. This rule matches the routes directory alone,
// so an arm here reports `routes/api.users.server.ts` and denies what that one
// permits.
//
// A relative specifier reaches the same module and no pattern here sees it.
// Adopt boundary/import-policy in the structural tier with this rule.
// ──────────────────────────────────────────────────────────────────────

import { defineRule } from "@oxlint/plugins";
import { isArchitectureExemptPath } from "../lib/architecture-exempt-paths.ts";
import { visitModuleSources } from "../lib/module-source-visitor.ts";

const ROUTE_LAYER = /\/src\/routes\//;

// Two arms, and deliberately not three — see `Not here:` in the header for why `*/index.server`
// belongs to api/server-import-context and cannot be added back here.
const BANNED_SPECIFIERS = [/^@\/infrastructure\/db(?:\/|$)/, /^@\/env\.server$/];

export const routeThinnessRule = defineRule({
  meta: {
    type: "problem",
    messages: {
      serverOnlyImportInRoute:
        "Routes are isomorphic thin adapters. Import data through the client-safe feature barrel (@/features/<feature>), not DB or env.server.",
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
