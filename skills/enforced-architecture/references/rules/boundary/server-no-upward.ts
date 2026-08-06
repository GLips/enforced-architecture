// ─── boundary/server-no-upward ───────────────────────────────────────
//
// Tag:      boundary
// Mechanism: oxlint JS plugin (per-file, real-time)
// Blocking: Yes
//
// Prevents: Infrastructure modules importing from features, domains,
//           or routes. Infrastructure is a service provider — it sits
//           below features in the dependency graph and provides
//           capabilities (DB, auth, SDKs, telemetry) that features
//           consume. If infrastructure imports a feature, the
//           dependency arrow reverses, creating circular potential
//           and coupling infrastructure changes to feature internals.
//           If infrastructure needs feature-specific behavior, the
//           feature passes it as a parameter (dependency inversion).
//
// Applies:  All src/infrastructure/** files EXCEPT:
//           - Test files
//           - Scripts
//
// Error:    "Infrastructure modules cannot import from features,
//            domains, or routes. Infrastructure provides services to
//            upper layers — it does not consume them. If this module
//            needs feature-specific behavior, accept it as a parameter."
//
// ── Adapt ─────────────────────────────────────────────────────────────
//
// 1. The infrastructure directory — `INFRASTRUCTURE_LAYER`:
//      /src/infrastructure/   — standard (this template)
//      /src/infra/            — abbreviated naming
//      /src/adapters/         — ports-and-adapters naming
//
// 2. The layers above it — `UPPER_LAYER_SPECIFIER`:
//    The default bans features, domains, and routes, which are the
//    layers that sit above infrastructure in the dependency graph. Add a
//    project's own upper layers as further alternatives. The pattern
//    closes each segment with `(?:\/|$)` so it matches the bare barrel
//    `@/features` and a subpath, but NOT `@/features-legacy` or
//    `@/featuresets` — unbounded prefixes here were the single most
//    common over-match in this catalog.
//
// 3. Self-imports: infrastructure importing other infrastructure is
//    allowed (auth importing db, say), and so is reaching down to
//    `@/shared` or `@/env`. If a project needs to restrict cross-concern
//    infrastructure imports, that is a separate rule.
//
// 4. Registration:
//    Add the rule to the project's oxlint plugin
//    (`rules: { "server-no-upward": serverNoUpwardRule }`) and turn it
//    on in `.oxlintrc.json` (`"<plugin>/server-no-upward": "error"`).
//
// ──────────────────────────────────────────────────────────────────────

import { defineRule } from "@oxlint/plugins";
import { isArchitectureExemptPath } from "../lib/architecture-exempt-paths.ts";
import { visitModuleSources } from "../lib/module-source-visitor.ts";

const INFRASTRUCTURE_LAYER = /\/src\/infrastructure\//;
const UPPER_LAYER_SPECIFIER = /^@\/(?:features|domains|routes)(?:\/|$)/;

export const serverNoUpwardRule = defineRule({
  meta: {
    type: "problem",
    messages: {
      infraImportsUpperLayer:
        "Infrastructure modules cannot import from features, domains, or routes. Infrastructure provides services to upper layers — it does not consume them. If this module needs feature-specific behavior, accept it as a parameter.",
    },
  },
  create(context) {
    const { filename } = context;
    if (!INFRASTRUCTURE_LAYER.test(filename) || isArchitectureExemptPath(filename)) return {};

    return visitModuleSources((source, specifier) => {
      if (UPPER_LAYER_SPECIFIER.test(specifier)) {
        context.report({ node: source, messageId: "infraImportsUpperLayer" });
      }
    });
  },
});
