// ─── api/server-import-context ───────────────────────────────────────
//
// Makes sure: A `*/index.server` specifier appears only in a server context: a
// feature's `controllers/`, `service/` or `repo/` directory, anything under
// `infrastructure/`, and any file named `*.server.ts`. You change an export of
// an `index.server.ts`, and every caller outside a test sits in one of those
// places. To find them you read those directories, not the whole `ui/` and
// `routes/` trees.
//
// Do not add the routes profile to `runsOnServer`. A loader runs on the server
// for the first request, thus the directory looks like a server context. The
// same load path runs in the browser on a client-side navigation
// (`@tanstack/router-core/src/load-matches.ts` calls `route.options.loader`),
// so a route file is isomorphic. A route that needs the server barrel takes
// the name `*.server.ts`, as `routes/api.invoices.server.ts` does.
//
// The fastest way to clear this finding is to rename the file to `*.server.ts`.
// The name is a claim, and this rule takes the claim as given. Nothing here
// tests that the file runs only on the server, so a renamed UI module is
// exempt and reports nothing.
//
// That fix is also why a unit's own client barrel is NOT this rule's subject and
// returns early: renaming `index.ts` to `index.server.ts` deletes the unit's
// public surface, and "use the client-safe barrel `index` there" is an
// instruction `index` cannot follow. `api/barrel-direction` owns that file and
// names a fix that works. The two split on "what a unit's surface may NAME"
// versus "which contexts may reach PAST it", and `isUnitClientBarrel` in
// policy/declared-trees.ts holds the line so neither end can move it alone.
//
// A barrel that is not a unit's surface — `ui/index.ts` — stays here. It is an
// ordinary client module that happens to be spelled `index`, and the barrel rule
// never looks at it.
//
// Do not exempt type-only imports with `isTypeOnlyDeclaration`. A type is
// erased at build time, thus the exemption looks free. A client file that
// names a type from a server barrel still depends on that barrel's shape,
// which is the coupling every boundary rule in this catalog counts.
//
// SCOPE, and it is the same for every TREE-SCOPED rule in this catalog — which
// is every rule but `testing/no-module-mocking`, whose subject is a test file and
// which is therefore enabled globally. This rule is silent outside the declared
// trees, and silent on the files `isArchitectureExemptSourcePath` names inside
// them — tests, scripts, generated and ambient modules. Neither
// silence is coverage. `lib/define-tree-rule.ts` owns both, which is why no rule
// body checks either one.
// ─────────────────────────────────────────────────────────────────────

import { defineTreeRule } from "../lib/define-tree-rule.ts";
import { isServerContext, isUnitClientBarrel } from "../../policy/declared-trees.ts";
import { namesServerBarrel } from "../lib/server-barrel-specifier.ts";
import { visitModuleSources } from "../lib/module-source-visitor.ts";

export const serverImportContextRule = defineTreeRule({
  meta: {
    type: "problem",
    messages: {
      serverBarrelInClientContext:
        "*/{{serverBarrel}} is a server-only barrel and this is a client context. Routes are isomorphic; use the client-safe barrel {{clientBarrel}} there. This rule answers the CONTEXT question only — which server context may reach a given barrel is boundary/import-policy's answer, and from inside a feature that is {{controllersLayer}}/, {{serviceLayer}}/ and a {{serverSuffix}} module at the feature ROOT. Not the feature's own {{serverBarrel}}, which is a barrel and may name nothing outside its feature; not {{repoLayer}}/, which is a leaf; not {{infrastructureDir}}/, which sits below {{featuresDir}}/.",
    },
  },
  create(context, role) {
    if (isServerContext(role)) return {};
    // Ceded to `api/barrel-direction`, whose message names a fix a barrel can act on. The header
    // says why this is the one client position that is not this rule's.
    if (isUnitClientBarrel(role)) return {};

    const { vocabulary } = role.tree;
    const { serverBarrelModule } = vocabulary;

    return visitModuleSources((source, specifier) => {
      // `lib/server-barrel-specifier.ts` owns which spellings name the barrel, for this rule and
      // the barrel rule alike — the two held a copy each, and the copies disagreed about the bare
      // form.
      if (namesServerBarrel(specifier, serverBarrelModule)) {
        context.report({
          node: source,
          messageId: "serverBarrelInClientContext",
          data: {
            serverBarrel: serverBarrelModule,
            clientBarrel: vocabulary.clientBarrelModule,
            controllersLayer: vocabulary.featureLayerDirs.controllers,
            serviceLayer: vocabulary.featureLayerDirs.service,
            repoLayer: vocabulary.featureLayerDirs.repo,
            serverSuffix: vocabulary.serverModuleSuffix,
            infrastructureDir: vocabulary.infrastructureDir,
            featuresDir: vocabulary.featuresDir,
          },
        });
      }
    });
  },
});
