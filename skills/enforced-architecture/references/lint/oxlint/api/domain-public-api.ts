// ─── api/domain-public-api ───────────────────────────────────────────
//
// Tag:      api
// Mechanism: oxlint JS plugin (per-file, real-time)
// Blocking: Yes
//
// Prevents: Deep imports into domain internals, bypassing the public
//           API barrel. Domains expose their API through `index.ts`
//           (client-safe) and optionally `index.server.ts` (server-only).
//           Any import matching `@/domains/<name>/<path>` where <path>
//           is not exactly `index.server` is a violation. Without this rule,
//           consumers couple to internal file layout, making domain
//           restructuring impossible without cascading import changes.
//
// Applies:  All src/** files EXCEPT:
//           - Files inside the domains/ directory itself (internal
//             imports within a domain are unrestricted)
//           - Test files and scripts
//
// Error:    "Import from domain public API only:
//            @/domains/<domain> or @/domains/<domain>/index.server.
//            Deep imports into domain internals are not allowed."
//
// ── Adapt ────────────────────────────────────────────────────────────
//
// 1. Who is exempt — `DOMAIN_INTERNAL_PATH`:
//    The domains layer owns its own file layout, so files inside it may
//    reach anywhere. Adjust if the project names the layer differently.
//    Examples:
//      /src/domains/   — standard (this template)
//      /src/domain/    — singular naming
//      /src/core/      — if domains are called "core"
//
// 2. What counts as a deep import — `DOMAIN_DEEP_IMPORT`:
//    The import alias for the domains layer. Must stay anchored at the
//    start, so `@/domains-legacy/...` is a different directory.
//    Examples:
//      ^@/domains/([^/]+)/(.+)$   — standard (this template)
//      ^@/core/([^/]+)/(.+)$      — if domains are called "core"
//
// 3. Server barrel exception — `SERVER_BARREL_PATH`:
//    The one deep path callers may use. Drop the comparison entirely if
//    the project has no server-only barrels for domains, or rename it if
//    the project spells the barrel differently.
//
// 4. Registration:
//    Add the rule to the project's oxlint plugin
//    (`rules: { "domain-public-api": domainPublicApiRule }`) and turn it
//    on in `.oxlintrc.json` (`"<plugin>/domain-public-api": "error"`).
//
// ─────────────────────────────────────────────────────────────────────

import { defineRule } from "@oxlint/plugins";
import { isArchitectureExemptPath } from "../lib/architecture-exempt-paths.ts";
import { visitModuleSources } from "../lib/module-source-visitor.ts";

// Anchored on `/src/` so a sibling directory that merely starts the same way — `src/domains-legacy/` —
// does not inherit the domain layer's freedom to reach into its own internals.
const DOMAIN_INTERNAL_PATH = /\/src\/domains\//;

// A plain barrel import (`@/domains/pricing`, nothing after) never matches: the pattern requires a
// path segment past the domain name. Anchored at the start so `@/domains-legacy/pricing/rate` is a
// different top-level directory, not a domain internal.
const DOMAIN_DEEP_IMPORT = /^@\/domains\/[^/]+\/(.+)$/;

// Compared for equality, not tested as a prefix, so `index.server-config` and a nested
// `sub/index.server` are still deep imports.
const SERVER_BARREL_PATH = "index.server";

export const domainPublicApiRule = defineRule({
  meta: {
    type: "problem",
    messages: {
      deepDomainImport:
        "Import from domain public API only: @/domains/<domain> or @/domains/<domain>/index.server. Deep imports into domain internals are not allowed.",
    },
  },
  create(context) {
    const { filename } = context;
    if (isArchitectureExemptPath(filename)) return {};
    if (DOMAIN_INTERNAL_PATH.test(filename)) return {};

    return visitModuleSources((source, specifier) => {
      const deep = DOMAIN_DEEP_IMPORT.exec(specifier);
      if (deep === null) return;
      if (deep[1] === SERVER_BARREL_PATH) return;
      context.report({ node: source, messageId: "deepDomainImport" });
    });
  },
});
