// ─── boundary/shared-ui-purity ───────────────────────────────────────
//
// Tag:       boundary
// Mechanism: oxlint JS plugin (per-file, real-time)
// Blocking:  Yes
//
// Prevents: Shared UI components importing from features, domains,
//           infrastructure, or routes. Shared UI must be domain-agnostic
//           presentational primitives (buttons, modals, form inputs,
//           layout components). If a component needs business logic or
//           feature-specific data, it belongs in features/*/ui/, not in
//           shared/ui/. This boundary ensures shared UI components are
//           reusable across any feature without dragging in dependencies.
//
// Applies:  All src/shared/ui/** files EXCEPT:
//           - Test files
//
// Error:    "shared/ui/* modules must be domain-agnostic UI primitives.
//            They cannot import from features, domains, infrastructure,
//            or routes."
//
// ── Adapt ─────────────────────────────────────────────────────────────
//
// 1. Which files are shared UI — `SHARED_UI`:
//    Adjust to match where the project places shared UI.
//    Examples:
//      /\/src\/shared\/ui\//   — nested under shared (this template)
//      /\/src\/ui\//           — top-level UI directory
//      /\/src\/components\//   — if shared UI is called "components"
//    Keep the trailing separator: without it the pattern also claims a
//    sibling `src/shared/ui-kit/`, which is a different directory.
//
// 2. What shared UI may not import — `BANNED_LAYERS`:
//    The default bans features, domains, infrastructure, and routes.
//    Shared UI sits at the bottom of the dependency graph alongside
//    shared utilities. Add further top-level directories the project
//    has that shared UI should not reach. Each alternative is closed
//    with `(?:\/|$)` so the bare barrel (`@/features`) matches while a
//    neighbour that merely shares the prefix (`@/features-legacy`,
//    `@/featuresets`) does not — that over-match is what trains people
//    to ignore the rule.
//
// 3. Env access:
//    The template allows shared UI to import @/env.client (for
//    client-safe config like CDN URLs or feature flags). To require
//    shared UI to be completely env-agnostic, add to `BANNED_LAYERS`:
//      /^@\/env(?:\.|$)/
//
// 4. Registration:
//    Add the rule to the project's oxlint plugin
//    (`rules: { "shared-ui-purity": sharedUiPurityRule }`) and turn it on
//    in `.oxlintrc.json` (`"<plugin>/shared-ui-purity": "error"`).
//
// ──────────────────────────────────────────────────────────────────────

import { defineRule } from "@oxlint/plugins";
import { isArchitectureExemptPath } from "../lib/architecture-exempt-paths.ts";
import { visitModuleSources } from "../lib/module-source-visitor.ts";

const SHARED_UI = /\/src\/shared\/ui\//;

const BANNED_LAYERS = /^@\/(?:features|domains|infrastructure|routes)(?:\/|$)/;

export const sharedUiPurityRule = defineRule({
  meta: {
    type: "problem",
    messages: {
      appImportInSharedUi:
        "shared/ui/* modules must be domain-agnostic UI primitives. They cannot import from features, domains, infrastructure, or routes. If this component needs feature-specific data or logic, move it to features/*/ui/ instead.",
    },
  },
  create(context) {
    const { filename } = context;
    if (isArchitectureExemptPath(filename) || !SHARED_UI.test(filename)) return {};

    return visitModuleSources((source, specifier) => {
      if (BANNED_LAYERS.test(specifier)) {
        context.report({ node: source, messageId: "appImportInSharedUi" });
      }
    });
  },
});
