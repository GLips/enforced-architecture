// ─── api/barrel-direction ────────────────────────────────────────────
//
// Makes sure: A client barrel — `index.ts` in `src/domains/<name>/` or
// `src/features/<name>/` — names no `index.server` module, its own or another
// unit's. You add an export to `index.server.ts`, and you do not then open
// `index.ts` to check what a client component now gets from it. The other
// direction stays legal, so `index.server.ts` re-exports `./index` and one
// import in a server context gives the whole feature API.
//
// Do not narrow `SERVER_BARREL_SPECIFIER` to the barrel's own sibling
// (`./index.server`). That one pair of files looks like the whole subject. A
// client barrel that re-exports `../audit/index.server` puts a server-only
// module in the client bundle, the same as its own sibling does.
//
// Do not exempt type-only imports with `isTypeOnlyDeclaration`. A type is
// erased at build time, thus the exemption looks free. A client barrel that
// re-exports a type from `index.server.ts` binds its public API to that file:
// rename the type there and the client barrel breaks.
//
// This rule reads the specifiers of one file, and follows nothing below them.
// A client barrel that reaches a server-only package through a client module
// is `api/barrel-purity`'s finding, so green here is not a clean bundle.
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
