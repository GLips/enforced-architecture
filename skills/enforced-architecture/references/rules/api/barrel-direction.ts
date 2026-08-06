// ─── api/barrel-direction ────────────────────────────────────────────
//
// Tag:      api
// Mechanism: oxlint JS plugin (per-file, real-time)
// Blocking: Yes
//
// Prevents: Client-safe barrel files (index.ts) importing from the
//           server-only barrel (index.server.ts). The server barrel
//           extends the client-safe API; the reverse pulls server-only
//           code into client bundles through the barrel, causing bundler
//           errors in SSR frameworks with server/client splitting.
//
//           This is a one-directional rule:
//           - index.server.ts MAY re-export from index.ts (superset pattern)
//           - index.ts MUST NOT import from index.server.ts
//
// Applies:  Barrel index.ts files in domains/ and features/ only.
//           Matched by path pattern: src/(domains|features)/<name>/index.ts
//
// Error:    "Barrel index.ts must not import from index.server.ts — this
//            pulls server-only code into client bundles. If the export is
//            client-safe (types, createServerFn references), re-export it
//            from controllers/ instead. If it is server-only, it belongs
//            in index.server.ts only."
//
// ── Adapt ────────────────────────────────────────────────────────────
//
// 1. Barrel file location — `CLIENT_BARREL_FILE`:
//    Adjust to match where the project places barrel files.
//    Examples:
//      /src/(?:domains|features)/[^/]+/index\.[tj]sx?$  — standard (this template)
//      /src/features/[^/]+/index\.[tj]sx?$              — no domains layer
//      /src/modules/[^/]+/index\.[tj]sx?$               — modules instead of features
//    Add other top-level directories here if they use the same two-barrel
//    pattern (a shared/ layer with its own server barrel, say).
//
// 2. Server barrel name — `SERVER_BARREL_SPECIFIER`:
//    If the project names the server-only barrel differently, adjust.
//    Examples:
//      index\.server  — standard (this template)
//      server         — alternative naming (requires explicit vite config)
//      server-only    — alternative naming
//
// 3. Registration:
//    Add the rule to the project's oxlint plugin
//    (`rules: { "barrel-direction": barrelDirectionRule }`) and turn it on
//    in `.oxlintrc.json` (`"<plugin>/barrel-direction": "error"`).
//
// ─────────────────────────────────────────────────────────────────────

import { defineRule } from "@oxlint/plugins";
import { isArchitectureExemptPath } from "../lib/architecture-exempt-paths.ts";
import { visitModuleSources } from "../lib/module-source-visitor.ts";

// Anchored on `/src/` and on exactly one segment between the layer and the barrel, so
// `src/features-legacy/billing/index.ts` and `src/features/billing/ui/index.ts` are not mistaken
// for the feature's public barrel. `index.server.ts` does not match this pattern — the server
// barrel is the one file allowed to import in either direction.
const CLIENT_BARREL_FILE = /\/src\/(?:domains|features)\/[^/]+\/index\.[tj]sx?$/;

// The last segment must BE `index.server`, so a neighbour named `index.server-config` is a
// different module. Matches the barrel however it is spelled from inside the feature: `./index.server`,
// `@/features/billing/index.server`, `../billing/index.server`, with or without an extension.
const SERVER_BARREL_SPECIFIER = /(?:^|\/)index\.server(?:\.[tj]sx?)?$/;

export const barrelDirectionRule = defineRule({
  meta: {
    type: "problem",
    messages: {
      clientBarrelImportsServerBarrel:
        "Barrel index.ts must not import from index.server.ts — this pulls server-only code into client bundles. If the export is client-safe (types, createServerFn references), re-export it from controllers/ instead. If it is server-only, it belongs in index.server.ts only.",
    },
  },
  create(context) {
    const { filename } = context;
    if (isArchitectureExemptPath(filename)) return {};
    if (!CLIENT_BARREL_FILE.test(filename)) return {};

    return visitModuleSources((source, specifier) => {
      if (SERVER_BARREL_SPECIFIER.test(specifier)) {
        context.report({ node: source, messageId: "clientBarrelImportsServerBarrel" });
      }
    });
  },
});
