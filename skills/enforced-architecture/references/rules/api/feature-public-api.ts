// ─── api/feature-public-api ──────────────────────────────────────────
//
// Tag:      api
// Mechanism: oxlint JS plugin (per-file, real-time)
// Blocking: Yes
//
// Prevents: Deep imports into feature internals (controllers/, service/,
//           repo/) from outside the feature, bypassing the public API
//           barrel. Features expose their API through `index.ts`
//           (client-safe) and `index.server.ts` (server-only). Without this
//           rule, consumers couple to internal file layout, making
//           feature restructuring impossible without cascading changes.
//
//           Three caller contexts have different allowed deep-import
//           patterns:
//           - Routes: may import /ui/* for page composition
//           - Other features: may import /index.server only
//           - Domains/shared/infrastructure: barrel only, no deep imports
//
// Applies:  All src/** files EXCEPT:
//           - Test files and scripts
//           (Files inside the same feature are excluded by the
//            same-feature check in the cross-feature branch.)
//
// Error:    Context-specific messages explaining which deep imports
//           are allowed from the caller's location.
//
// ── Adapt ────────────────────────────────────────────────────────────
//
// 1. Where routes live — `ROUTES_PATH`:
//    Adjust if the project uses a different transport layer name.
//    Examples:
//      /src/routes/   — file-based routing (this template)
//      /src/pages/    — Next.js-style pages
//      /src/app/      — Next.js app router
//
// 2. What routes may deep-import — `ROUTE_ALLOWED_PATH`:
//    Routes are isomorphic, so they get the UI directory and nothing
//    else — not even the server barrel. Drop this constant (and report
//    every deep import from a route) if all UI goes through barrels.
//
// 3. The cross-feature server seam — `SERVER_BARREL_PATH`:
//    The one deep path a feature may use to reach another feature.
//    Drop the comparison if the project has no server-only barrels.
//
// 4. Which layers get no deep imports at all — `LOWER_LAYER_PATH`:
//    Domains, shared and infrastructure sit below features, so they may
//    only use the barrel. Adjust if the project lets infrastructure
//    deep-import features (unusual).
//
// 5. Who counts as "inside the feature" — `CALLER_FEATURE`:
//    The path shape that names the feature a file belongs to. Compared
//    for equality against the imported feature, so a feature reaching
//    its own internals through the alias stays silent.
//
// 6. Registration:
//    Add the rule to the project's oxlint plugin
//    (`rules: { "feature-public-api": featurePublicApiRule }`) and turn
//    it on in `.oxlintrc.json` (`"<plugin>/feature-public-api": "error"`).
//
// ─────────────────────────────────────────────────────────────────────

import { defineRule } from "@oxlint/plugins";
import { isArchitectureExemptPath } from "../lib/architecture-exempt-paths.ts";
import { visitModuleSources } from "../lib/module-source-visitor.ts";

// A plain barrel import (`@/features/billing` with nothing after) never matches — the pattern
// requires a path segment past the feature name. Anchored at the start so `@/features-legacy/…` is
// a different top-level directory.
const DEEP_FEATURE_IMPORT = /^@\/features\/([^/]+)\/(.+)$/;

// Anchored on `/src/` so `src/features-legacy/checkout/…` is not treated as the checkout feature.
const CALLER_FEATURE = /\/src\/features\/([^/]+)\//;
const ROUTES_PATH = /\/src\/routes\//;
const LOWER_LAYER_PATH = /\/src\/(?:domains|shared|infrastructure)\//;

// Segment-anchored: `ui` itself and anything under it, but not a sibling named `uikit`.
const ROUTE_ALLOWED_PATH = /^ui(?:\/|$)/;

// Compared for equality, not tested as a prefix, so `index.server-config` and a nested
// `sub/index.server` are still deep imports.
const SERVER_BARREL_PATH = "index.server";

export const featurePublicApiRule = defineRule({
  meta: {
    type: "problem",
    messages: {
      fromRoute:
        "Routes are isomorphic and may deep-import only @/features/<feature>/ui/*. Use the client-safe feature barrel for data and server-function references.",
      crossFeature:
        "Cross-feature deep imports are limited to @/features/<feature>/index.server. Use the feature barrel (@/features/<feature>) for other exports.",
      fromLowerLayer:
        "Only feature barrel imports (@/features/<feature>) are allowed from domains, shared, and infrastructure. Add the needed export to the feature's barrel (index.ts or index.server.ts).",
    },
  },
  create(context) {
    const { filename } = context;
    if (isArchitectureExemptPath(filename)) return {};

    const callerFeature = CALLER_FEATURE.exec(filename)?.[1];

    return visitModuleSources((source, specifier) => {
      const deep = DEEP_FEATURE_IMPORT.exec(specifier);
      if (deep === null) return;
      const [, importedFeature, path] = deep;

      if (ROUTES_PATH.test(filename)) {
        if (!ROUTE_ALLOWED_PATH.test(path)) {
          context.report({ node: source, messageId: "fromRoute" });
        }
        return;
      }
      if (callerFeature !== undefined) {
        // Reaching into a feature's own internals by its alias is still inside the feature.
        if (callerFeature === importedFeature) return;
        if (path !== SERVER_BARREL_PATH) {
          context.report({ node: source, messageId: "crossFeature" });
        }
        return;
      }
      if (LOWER_LAYER_PATH.test(filename)) {
        context.report({ node: source, messageId: "fromLowerLayer" });
      }
    });
  },
});
