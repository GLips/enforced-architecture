// ─── boundary/client-server-infra ────────────────────────────────────
//
// Makes sure: A client file imports only the infrastructure modules on
// `CLIENT_SAFE_INFRASTRUCTURE`. The build puts no database client, no server
// auth module, no SDK wrapper and no telemetry key in a browser chunk. To learn
// what the browser takes from src/infrastructure/, you read that list.
//
// A route loader is a client context: @tanstack/router-core calls
// route.options.loader from the shared load path, which the browser runs too. Do
// not exempt a loader.
//
// A file named `*.server.ts` is a server context wherever it sits, so this rule
// does not check it. That exemption is about the BUNDLE — the file is never in a
// client chunk — and it is not a permission to import infrastructure. Inside a
// feature it usually is not one: `index.server.ts` classifies as the feature
// barrel and `notify.server.ts` as a feature-root file, and
// boundary/import-policy denies infrastructure to both. The rename removes this
// finding and creates that one.
//
// Each entry in `CLIENT_SAFE_INFRASTRUCTURE` matches the specifier EXACTLY. An
// entry that ends with `(?:\/|$)` instead of `$` admits a whole subtree, and the
// browser then gets every module in it.
//
// A relative specifier reaches the same module and no pattern here sees it.
// Adopt boundary/import-policy in the structural tier with this rule.
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
