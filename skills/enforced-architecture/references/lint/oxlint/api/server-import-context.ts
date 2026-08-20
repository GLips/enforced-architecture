// ─── api/server-import-context ───────────────────────────────────────
//
// Tag:      api
// Mechanism: oxlint JS plugin (per-file, real-time)
// Blocking: Yes
//
// Prevents: Client contexts importing server-only barrels (*/index.server
//           paths). Server barrels export code that depends on server-
//           only packages (DB clients, auth infrastructure, SDK
//           wrappers). Importing them from UI files, client-safe
//           barrels, or shared modules leaks server-only code into
//           client bundles.
//
//           Server contexts are explicitly allowed:
//           - features/*/controllers/
//           - features/*/service/
//           - features/*/repo/
//           - infrastructure/*
//           - Any file named *.server.ts or *.server.tsx
//
//           Everything else is a client context where */server imports
//           are denied.
//
// Applies:  All src/** files EXCEPT:
//           - Server contexts listed above
//           - Test files and scripts
//
// Error:    "*/index.server is a server-only barrel and this is a client
//            context. Which server context may reach a given barrel is
//            boundary/import-policy's answer — see the message."
//
// Source: @tanstack/router-core/src/load-matches.ts
//         (the shared load path invokes route.options.loader).
//
// ── Adapt ────────────────────────────────────────────────────────────
//
// 1. Who may import a server barrel — `SERVER_CONTEXTS`:
//    Add or remove directories that count as server contexts in the
//    project. Common additions:
//      /src/api/                      — a standalone api/ layer
//      /src/features/[^/]+/actions/   — an actions/ layer
//    If infrastructure lives under a different name, adjust that entry:
//      /src/infrastructure/  — standard (this template)
//      /src/infra/           — shortened name
//      /src/lib/             — if infrastructure is called lib
//
// 2. Server file naming convention — the `\.server\.[tj]sx?$` entry of
//    `SERVER_CONTEXTS`. It covers every file using the .server.ts
//    convention, including index.server.ts barrels themselves.
//    Examples:
//      \.server\.[tj]sx?$   — standard (this template)
//      /server\.[tj]sx?$    — alternative naming
//
// 3. What a server barrel looks like — `SERVER_BARREL_SPECIFIER`:
//    Matches any specifier whose last segment is `index.server`.
//    Examples:
//      /index\.server  — standard (this template)
//      /server         — alternative naming
//
// 4. Registration:
//    Add the rule to the project's oxlint plugin
//    (`rules: { "server-import-context": serverImportContextRule }`) and
//    turn it on in `.oxlintrc.json`
//    (`"<plugin>/server-import-context": "error"`).
//
// ─────────────────────────────────────────────────────────────────────

import { defineRule } from "@oxlint/plugins";
import { isArchitectureExemptPath } from "../lib/architecture-exempt-paths.ts";
import { visitModuleSources } from "../lib/module-source-visitor.ts";

// Anchored on `/src/` and on whole segments, so `src/features/billing/legacy-service/` is still a
// client context — a directory that merely ends in a server layer's name is not that layer.
const SERVER_CONTEXTS = [
  /\/src\/infrastructure\//,
  /\/src\/features\/[^/]+\/(?:controllers|repo|service)\//,
  /\.server\.[tj]sx?$/,
];

// Requires a preceding `/`, matching the relative (`../billing/index.server`) and aliased
// (`@/features/billing/index.server`) spellings alike, and ends at the segment boundary so a
// neighbour named `index.server-config` is a different module.
const SERVER_BARREL_SPECIFIER = /\/index\.server(?:\.[tj]sx?)?$/;

export const serverImportContextRule = defineRule({
  meta: {
    type: "problem",
    messages: {
      serverBarrelInClientContext:
        "*/index.server is a server-only barrel and this is a client context. Routes are isomorphic; use the client-safe barrel there. This rule answers the CONTEXT question only — which server context may reach a given barrel is boundary/import-policy's answer, and from inside a feature that is controllers/, service/ and a .server.ts module at the feature ROOT. Not the feature's own index.server.ts, which is a barrel and may name nothing outside its feature; not repo/, which is a leaf; not infrastructure/, which sits below features.",
    },
  },
  create(context) {
    const { filename } = context;
    if (isArchitectureExemptPath(filename)) return {};
    if (SERVER_CONTEXTS.some((serverContext) => serverContext.test(filename))) return {};

    return visitModuleSources((source, specifier) => {
      if (SERVER_BARREL_SPECIFIER.test(specifier)) {
        context.report({ node: source, messageId: "serverBarrelInClientContext" });
      }
    });
  },
});
