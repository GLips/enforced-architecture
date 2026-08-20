// ─── api/barrel-direction ────────────────────────────────────────────
//
// Makes sure: A client barrel — `index.ts` in `src/domains/<name>/` or
// `src/features/<name>/` — names no `index.server` module, its own or another
// unit's. You add an export to `index.server.ts`, and you do not then open
// `index.ts` to check what a client component now gets from it. The other
// direction stays legal, so `index.server.ts` re-exports `./index` and one
// import in a server context gives the whole feature API.
//
// Do not narrow `namesServerBarrel` to the barrel's own sibling
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
import { isModule } from "../../policy/declared-trees.ts";
import { withoutSourceExtension } from "../../policy/layout.ts";
import { visitModuleSources } from "../lib/module-source-visitor.ts";

/**
 * The last segment must BE the server barrel, so a neighbour named
 * `index.server-config` is a different module. Matches it however it is spelled
 * from inside the unit: `./index.server`, `@/features/billing/index.server`,
 * `../billing/index.server`, with or without an extension.
 */
function namesServerBarrel(specifier: string, serverBarrelModule: string): boolean {
  const bare = withoutSourceExtension(specifier);
  return bare === serverBarrelModule || bare.endsWith(`/${serverBarrelModule}`);
}

export const barrelDirectionRule = defineTreeRule({
  meta: {
    type: "problem",
    messages: {
      clientBarrelImportsServerBarrel:
        "Barrel {{clientBarrel}} must not import from {{serverBarrel}} — this pulls server-only code into client bundles. If the export is client-safe (types, createServerFn references), re-export it from {{controllersLayer}}/ instead. If it is server-only, it belongs in {{serverBarrel}} only.",
    },
  },
  create(context, role) {
    // The CLIENT barrel of a feature or a domain, and nothing else. Read off the
    // classification rather than off a path regex, so
    // `features-legacy/billing/index.ts` and `features/billing/ui/index.ts` are
    // not mistaken for a public barrel and a renamed features directory does not
    // silence the rule. The server barrel is excluded by name — it is the one
    // file allowed to import in either direction — which is why this tests the
    // client barrel module rather than the `feature-barrel` profile, and why the
    // domain arm (no barrel profile of its own) is reachable at all.
    const { vocabulary } = role.tree;
    const unit = role.place?.unit;
    if (unit === undefined) return {};
    if (!isModule(role, `${unit}/${vocabulary.clientBarrelModule}`)) return {};
    if (role.place?.profile !== "feature-barrel" && role.place?.profile !== "domain") return {};

    return visitModuleSources((source, specifier) => {
      if (namesServerBarrel(specifier, vocabulary.serverBarrelModule)) {
        context.report({
          node: source,
          messageId: "clientBarrelImportsServerBarrel",
          data: {
            clientBarrel: vocabulary.clientBarrelModule,
            serverBarrel: vocabulary.serverBarrelModule,
            controllersLayer: vocabulary.featureLayerDirs.controllers,
          },
        });
      }
    });
  },
});
