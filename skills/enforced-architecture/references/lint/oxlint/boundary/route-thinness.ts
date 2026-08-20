// ─── boundary/route-thinness ─────────────────────────────────────────
//
// Makes sure: No route file imports the database layer or the server env module.
// A route file runs in the browser too, so that env import puts a secret in the
// browser bundle. To find a query you read the features tree, and a framework
// migration rewrites the routes tree with no data access to move.
//
// Not here: `*/index.server` in a route. api/server-import-context owns it, and
// owns it with a distinction this rule cannot make: a route file named
// `*.server.ts` is a server context and MAY import a server barrel, while
// `routes/invoices.tsx` may not. This rule matches the routes directory alone,
// so an arm here reports `routes/api.users.server.ts` and denies what that one
// permits.
//
// A relative specifier reaches the same module and no pattern here sees it.
// Adopt boundary/import-policy in the structural tier with this rule.
//
// SCOPE, and it is the same for every rule in this catalog: this rule is silent
// outside the declared trees, and silent on the files `isArchitectureExemptPath`
// names inside them — tests, scripts, generated and ambient modules. Neither
// silence is coverage. `lib/define-tree-rule.ts` owns both, which is why no rule
// body checks either one.
// ──────────────────────────────────────────────────────────────────────

import { defineTreeRule } from "../lib/define-tree-rule.ts";
import {
  aliasSpecifierFor,
  isUnderPath,
  type TreeVocabulary,
  dbDir,
} from "../../policy/layout.ts";
import { visitModuleSources } from "../lib/module-source-visitor.ts";

// The two areas a route may not name, spelled from the tree's vocabulary. Two
// arms, and deliberately not three — see `Not here:` in the header for why a
// server barrel belongs to api/server-import-context and cannot be added back
// here.
//
// Every env module the tree declares as `env-server` is banned, not just the one
// spelled `env.server`: a project on the single-module option puts the same
// secrets in `env.ts`, and a rule naming one spelling misses the other in
// silence.
function bannedSpecifiers(vocabulary: TreeVocabulary): string[] {
  const serverEnv = Object.entries(vocabulary.envModules)
    .filter(([, exposure]) => exposure === "env-server")
    .map(([module]) => aliasSpecifierFor(vocabulary, module));
  return [aliasSpecifierFor(vocabulary, dbDir(vocabulary)), ...serverEnv];
}

export const routeThinnessRule = defineTreeRule({
  meta: {
    type: "problem",
    messages: {
      serverOnlyImportInRoute:
        "Routes are isomorphic thin adapters. Import data through the client-safe feature barrel (@/features/<feature>), not DB or env.server.",
    },
  },
  create(context, role) {
    if (role.place?.profile !== "route") return {};
    const banned = bannedSpecifiers(role.tree.vocabulary);

    return visitModuleSources((source, specifier) => {
      if (banned.some((prefix) => isUnderPath(specifier, prefix))) {
        context.report({ node: source, messageId: "serverOnlyImportInRoute" });
      }
    });
  },
});
