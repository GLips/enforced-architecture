import { definePlugin } from "@oxlint/plugins";
import { dbIsolationRule } from "./boundary/db-isolation.ts";

// The catalog's rules, registered as one oxlint JS plugin. Copy this file into the project
// alongside the rules taken from the catalog, drop the registrations for rules not adopted, and
// point `.oxlintrc.json` at it:
//
//   { "jsPlugins": ["./oxlint/plugin.ts"],
//     "rules": { "arch/db-isolation": "error", … } }
//
// Rule keys match their file names, so a diagnostic id (`arch/db-isolation`) is also the path to
// the rule that raised it. Rename `meta.name` to whatever prefix reads best in the project's
// diagnostics; every rule key in `.oxlintrc.json` inherits it.
export default definePlugin({
  meta: { name: "arch" },
  rules: {
    "db-isolation": dbIsolationRule,
  },
});
