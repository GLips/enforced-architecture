// ─── boundary/shared-purity ──────────────────────────────────────────
//
// Tag:       boundary
// Mechanism: oxlint JS plugin (per-file, real-time)
// Blocking:  Yes
//
// Prevents: Shared utility modules (non-UI) importing ANY application
//           module via @/ paths. Shared utilities are the absolute
//           bottom of the dependency graph. They may only import from
//           each other (via relative paths) and from external packages.
//           Any @/ import from shared/ creates an upward dependency
//           that makes the utility non-portable and creates potential
//           circular dependency chains.
//
// Applies:  Top-level files in src/shared/*.{ts,tsx} EXCEPT:
//           - src/shared/ui/** (governed by shared-ui-purity instead)
//           - Test files
//
// Error:    "Shared utility modules must be pure — they cannot import
//            app modules via @/ paths. Only external package imports
//            are allowed."
//
// ── Adapt ─────────────────────────────────────────────────────────────
//
// 1. Which files are shared utilities — `SHARED_UTILITY`:
//    Adjust to match where the project places shared utilities.
//    Examples:
//      /\/src\/shared\/[^/]+\.[tj]sx?$/  — top-level files only (this template)
//      /\/src\/shared\//                 — all files including subdirectories
//      /\/src\/lib\//                    — if shared utilities are called "lib"
//      /\/src\/utils\//                  — if shared utilities are called "utils"
//    The default is deliberately narrow: a nested `src/shared/utils/format.ts`
//    is NOT covered. Broaden it and `SHARED_UI` starts doing real work.
//    Keep the `/src/` prefix and the trailing separator either way, so a
//    sibling `src/shared-utils/` is not read as this directory.
//
// 2. Where the more permissive UI rule takes over — `SHARED_UI`:
//    shared/ui/ has its own rule (shared-ui-purity) that allows @/shared
//    imports, so this rule stands aside for it. If shared UI lives
//    somewhere else, point this at that directory instead.
//
// 3. What a shared utility may not import — `APP_ALIAS`:
//    The default blocks EVERY @/ import, which is the strictest form of
//    the rule. To allow specific app modules (say client-safe config),
//    add exceptions inside the visitor:
//      if (/^@\/env\.client$/.test(specifier)) return;
//
// 4. Registration:
//    Add the rule to the project's oxlint plugin
//    (`rules: { "shared-purity": sharedPurityRule }`) and turn it on in
//    `.oxlintrc.json` (`"<plugin>/shared-purity": "error"`).
//
// ──────────────────────────────────────────────────────────────────────

import { defineRule } from "@oxlint/plugins";
import { isArchitectureExemptPath } from "../lib/architecture-exempt-paths.ts";
import { visitModuleSources } from "../lib/module-source-visitor.ts";

const SHARED_UTILITY = /\/src\/shared\/[^/]+\.[tj]sx?$/;

// Looks redundant while SHARED_UTILITY matches top-level files only — `shared/ui/badge.tsx` has a
// separator SHARED_UTILITY's `[^/]+` cannot cross, so it never reaches here. It is kept because
// broadening SHARED_UTILITY (Adapt 1) is the expected adaptation, and without this the broadened
// rule would silently claim shared/ui/ and start reporting the @/shared imports that rule allows.
const SHARED_UI = /\/src\/shared\/ui\//;

// Only the alias root. `@sentry/node` and `@loops-so/node` start with `@` but are packages, and a
// pattern that reads them as app modules makes this rule unusable in any project with scoped deps.
const APP_ALIAS = /^@\//;

export const sharedPurityRule = defineRule({
  meta: {
    type: "problem",
    messages: {
      appImportInSharedUtility:
        "Shared utility modules must be pure — they cannot import app modules via @/ paths. Only relative imports (within shared/) and external packages are allowed. If this module needs app dependencies, move it to the feature or domain that owns it.",
    },
  },
  create(context) {
    const { filename } = context;
    if (isArchitectureExemptPath(filename) || SHARED_UI.test(filename)) return {};
    if (!SHARED_UTILITY.test(filename)) return {};

    return visitModuleSources((source, specifier) => {
      if (APP_ALIAS.test(specifier)) {
        context.report({ node: source, messageId: "appImportInSharedUtility" });
      }
    });
  },
});
