// ─── placement/server-fn-placement ──────────────────────────────────────
//
// Makes sure: The name createServerFn appears only under
// features/<name>/controllers/. To read every endpoint a feature exposes, you
// open one directory. You do not search the whole tree for a definition that
// sits in a UI file or in an infrastructure helper.
//
// The subject is the name and not a call shape. A module outside controllers/
// has no reason to name the factory at all, thus the rule reports the import as
// well. Do not narrow the rule to `createServerFn(...)`. An alias at the import
// (`createServerFn as makeFn`) or a namespace access (`start.createServerFn()`)
// then passes, and the definition under it passes too.
//
// The message names the destination, features/<name>/controllers/. A message
// that only refuses leaves the author with the same question, and that author
// turns the rule off.
//
// A file inside controllers/ is not correct for that reason alone. Whether the
// server function checks its input is placement/server-fn-validation's finding.
// What else the module exports is
// placement/no-plain-export-in-server-fn-module's.
// ──────────────────────────────────────────────────────────────────────

import { defineRule } from "@oxlint/plugins";
import { classifyFileRole, isAtProfile } from "../../policy/declared-trees.ts";
import { visitIdentifierNamed } from "../lib/identifier-occurrences.ts";

const SERVER_FN_FACTORY = "createServerFn";

export const serverFnPlacementRule = defineRule({
  meta: {
    type: "problem",
    messages: {
      serverFnOutsideControllers:
        "createServerFn must be placed in feature controllers/ modules. Server functions are application delivery endpoints. Move this to features/<name>/controllers/.",
    },
  },
  create(context) {
    // The profile, not a path: a top-level `src/controllers/` is not a feature's
    // controllers layer, and a `legacy-controllers/` holding endpoints nobody
    // migrated classifies as nothing at all — which is exactly what this rule
    // exists to find.
    const role = classifyFileRole(context.filename);
    if (role === undefined || isAtProfile(role, "feature-controllers")) return {};

    return visitIdentifierNamed(SERVER_FN_FACTORY, (node) => {
      context.report({ node, messageId: "serverFnOutsideControllers" });
    });
  },
});
