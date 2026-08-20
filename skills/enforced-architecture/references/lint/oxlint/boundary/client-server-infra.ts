// ─── boundary/client-server-infra ────────────────────────────────────
//
// Tag:      boundary
// Mechanism: oxlint JS plugin (per-file, real-time)
// Blocking: Yes
//
// Prevents: Client contexts (UI files, barrel files, shared modules)
//           importing server-only infrastructure modules. Most
//           infrastructure is server-only (DB, auth, SDK wrappers,
//           telemetry). Only explicitly allowlisted infrastructure
//           modules are client-safe. Importing server-only infra from
//           client contexts leaks secrets into client bundles and causes
//           hydration failures in SSR frameworks.
//
// Applies:  All src/** files that are NOT server contexts:
//           - Excludes: infrastructure/**, scripts
//           - Excludes: features/*/controllers/**, features/*/repo/**,
//                       features/*/service/** (server layers)
//           - Excludes: any file named server.{ts,tsx}
//           - Excludes: test files
//
// Source: @tanstack/router-core/src/load-matches.ts
//         (the shared load path invokes route.options.loader).
//
// Error:    "Client contexts may only import client-safe infrastructure
//            modules. From inside a feature the placements that may take
//            this import are controllers/ and repo/ — see the message for
//            why the .server.ts suffix is not one of them."
//
// ── Adapt ─────────────────────────────────────────────────────────────
//
// 1. Who is a server context — `SERVER_LAYERS`:
//    The layers that may import infrastructure freely. The default is
//    infrastructure itself plus the three server-side feature layers
//    (controllers, repo, service). Add a project's extra server layers
//    here; every pattern is anchored on `/src/` and closed with `/` so a
//    directory that merely ends in the same word (`legacy-service/`)
//    does not inherit the exemption.
//
// 2. The server-module filename convention — `SERVER_MODULE`:
//    A file named `*.server.ts` is a server context wherever it sits,
//    so this rule stops looking at it. That exemption is about BUNDLING
//    — the file is never in a client chunk — and it is not a permission
//    to import infrastructure. Inside a feature it usually is not one:
//    `index.server.ts` classifies as the feature's barrel and
//    `notify.server.ts` as a feature-root file, and `boundary/import-policy`
//    denies infrastructure to both. The suffix silences THIS rule and
//    lights up that one. Change the pattern if the project marks
//    server-only modules some other way.
//
// 3. What counts as infrastructure — `INFRASTRUCTURE_SPECIFIER`:
//    Adjust to the project's alias for the infrastructure directory
//    (`@/infrastructure` here, `@/infra` or `@/adapters` elsewhere).
//
// 4. The client-safe allowlist — `CLIENT_SAFE_INFRASTRUCTURE`:
//    The infrastructure modules that are safe to import from client
//    contexts. Keep this list MINIMAL — every entry is a module that
//    will be included in client bundles. Entries match the specifier
//    EXACTLY, so `@/infrastructure/auth/client-legacy` is still a
//    violation; to allow a whole subtree, end the pattern with
//    `(?:\/|$)` instead of `$`. Examples:
//      @/infrastructure/auth/client            — browser-side auth
//      @/infrastructure/providers/query-client — TanStack Query setup
//      @/infrastructure/analytics/client       — client-side analytics
//
// 5. Registration:
//    Add the rule to the project's oxlint plugin
//    (`rules: { "client-server-infra": clientServerInfraRule }`) and
//    turn it on in `.oxlintrc.json`
//    (`"<plugin>/client-server-infra": "error"`).
//
// ──────────────────────────────────────────────────────────────────────

import { defineRule } from "@oxlint/plugins";
import { isArchitectureExemptPath } from "../lib/architecture-exempt-paths.ts";
import { visitModuleSources } from "../lib/module-source-visitor.ts";

const INFRASTRUCTURE_SPECIFIER = /^@\/infrastructure(?:\/|$)/;

const CLIENT_SAFE_INFRASTRUCTURE = [
  /^@\/infrastructure\/auth\/client$/,
  /^@\/infrastructure\/providers\/query-client$/,
];

const SERVER_LAYERS = [
  /\/src\/infrastructure\//,
  /\/src\/features\/[^/]+\/(?:controllers|repo|service)\//,
];
const SERVER_MODULE = /\.server\.[tj]sx?$/;

export const clientServerInfraRule = defineRule({
  meta: {
    type: "problem",
    messages: {
      serverOnlyInfraInClient:
        "Client contexts may only import client-safe infrastructure modules. From inside a feature, move it to controllers/ or to repo/ — or use the client-safe adapter. NOT service/, and NOT renaming the file to *.server.ts: a service layer imports no infrastructure at all, and a .server.ts at a feature root or as its barrel is a feature-root or feature-barrel file, which boundary/import-policy denies infrastructure to. Each of those silences this rule and lights up that one, and a pair of diagnostics forbidding each other's fix is an edit loop.",
    },
  },
  create(context) {
    const { filename } = context;
    if (!filename.includes("/src/") || isArchitectureExemptPath(filename)) return {};
    if (SERVER_MODULE.test(filename) || SERVER_LAYERS.some((layer) => layer.test(filename)))
      return {};

    return visitModuleSources((source, specifier) => {
      if (!INFRASTRUCTURE_SPECIFIER.test(specifier)) return;
      if (CLIENT_SAFE_INFRASTRUCTURE.some((safe) => safe.test(specifier))) return;
      context.report({ node: source, messageId: "serverOnlyInfraInClient" });
    });
  },
});
