// ─── structure/server-fn-placement ──────────────────────────────────────
//
// Tag:       structure
// Mechanism: oxlint JS plugin (per-file, real-time)
// Blocking:  Yes
//
// Prevents: Server function definitions (createServerFn) placed outside
//           the controllers/ layer. Server functions are application
//           delivery endpoints — they belong in the feature layer that
//           owns them, not scattered across infrastructure, domains,
//           shared utilities, or UI components.
//
// Applies:  All src/** files EXCEPT:
//           - features/*/controllers/** (IS the correct location)
//           - Test files and scripts
//
// Error:    "createServerFn must be placed in feature controllers/
//            modules. Server functions are application delivery
//            endpoints. Move this to features/<name>/controllers/."
//
// Note:     This is a claim about the NAME, not about a call shape, so
//           every mention outside controllers/ is reported — including
//           the import that brings it in. A module outside controllers/
//           has no reason to name the factory at all: importing it is
//           either a definition about to be written, or a leftover. The
//           GritQL original matched only `createServerFn(...)` and so
//           was evaded by aliasing the import or reaching the factory
//           through a namespace.
//
// ── Adapt ─────────────────────────────────────────────────────────────
//
// 1. `CONTROLLERS_PATH` — the one layer allowed to define endpoints:
//    Examples:
//      /\/src\/features\/[^/]+\/controllers\//  — layered features (this template)
//      /\/src\/modules\/[^/]+\/controllers\//   — if the project says "modules"
//      /\/src\/features\/[^/]+\/server\//       — if the controller layer
//                                                 is named "server/"
//
// 2. `SERVER_FN_FACTORY` — the framework's factory name:
//    Examples:
//      createServerFn     — TanStack Start (this template)
//      createServerAction — alternative naming
//      server$            — SolidStart convention
//
// 3. Registration:
//    Add the rule to the project's oxlint plugin
//    (`rules: { "server-fn-placement": serverFnPlacementRule }`) and
//    turn it on in `.oxlintrc.json`
//    (`"<plugin>/server-fn-placement": "error"`).
//
// ──────────────────────────────────────────────────────────────────────

import { defineRule } from "@oxlint/plugins";
import { isArchitectureExemptPath } from "../lib/architecture-exempt-paths.ts";
import { visitIdentifierNamed } from "../lib/identifier-occurrences.ts";

const SERVER_FN_FACTORY = "createServerFn";

// Anchored on both slashes: a top-level `src/controllers/` is not a feature's controllers, and a
// `legacy-controllers/` holding endpoints nobody migrated is exactly what this rule exists to find.
const CONTROLLERS_PATH = /\/src\/features\/[^/]+\/controllers\//;

export const serverFnPlacementRule = defineRule({
  meta: {
    type: "problem",
    messages: {
      serverFnOutsideControllers:
        "createServerFn must be placed in feature controllers/ modules. Server functions are application delivery endpoints. Move this to features/<name>/controllers/.",
    },
  },
  create(context) {
    const { filename } = context;
    if (CONTROLLERS_PATH.test(filename) || isArchitectureExemptPath(filename)) return {};

    return visitIdentifierNamed(SERVER_FN_FACTORY, (node) => {
      context.report({ node, messageId: "serverFnOutsideControllers" });
    });
  },
});
