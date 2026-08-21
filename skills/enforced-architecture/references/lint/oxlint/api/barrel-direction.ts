// ─── api/barrel-direction ────────────────────────────────────────────
//
// Makes sure: A client barrel — the `index.ts` at the root of a domain or a
// feature, in the default vocabulary — names no `index.server` module, its own
// or another unit's. You add an export to `index.server.ts`, and you do not then open
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
// The client barrel is THIS rule's subject alone. `api/server-import-context`
// fences the same specifier everywhere else in a client context and returns
// early here, because its message — "use the client-safe barrel `index` there" —
// is an instruction the barrel cannot follow, it being `index`, and its stated
// fastest fix, renaming the file to `*.server`, would delete the unit's public
// surface. Two subjects: what a unit's surface may NAME, and which contexts may
// reach PAST it. `isUnitClientBarrel` in policy/declared-trees.ts holds the line
// so neither end can move it alone.
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
import { isUnitClientBarrel } from "../../policy/declared-trees.ts";
import { namesServerBarrel } from "../lib/server-barrel-specifier.ts";
import { visitModuleSources } from "../lib/module-source-visitor.ts";

export const barrelDirectionRule = defineTreeRule({
  meta: {
    type: "problem",
    messages: {
      // Two messages, split on whether the unit HAS the layer the fix names. A domain is
      // unlayered — `placement/topology` treats it so, and `directory-model.md` says why — and a
      // domain barrel told to re-export from `controllers/` is told to use a directory it may not
      // create. This rule is the only reporter on both arms, so the wrong wording would be the
      // only wording.
      clientBarrelImportsServerBarrel:
        "Barrel {{clientBarrel}} must not import from {{serverBarrel}} — this pulls server-only code into client bundles. If the export is client-safe (types, createServerFn references), re-export it from {{controllersLayer}}/ instead. If it is server-only, it belongs in {{serverBarrel}} only.",
      domainBarrelImportsServerBarrel:
        "Barrel {{clientBarrel}} must not import from {{serverBarrel}} — this pulls server-only code into client bundles. A domain is unlayered, so there is no client-safe layer to re-export through: move the client-safe part into the domain's own modules, and leave the server-only part in {{serverBarrel}}, which a server context imports directly.",
    },
  },
  create(context, role) {
    // The CLIENT barrel of a feature or a domain, and nothing else — read off the classification
    // rather than a path regex, so `features-legacy/billing/index.ts` and
    // `features/billing/ui/index.ts` are not mistaken for a public barrel. The predicate is
    // `api/server-import-context`'s too, which is why it is not spelled here.
    if (!isUnitClientBarrel(role)) return {};

    const { vocabulary } = role.tree;
    const isDomain = role.place?.profile === "domain";

    return visitModuleSources((source, specifier) => {
      if (!namesServerBarrel(specifier, vocabulary.serverBarrelModule)) return;
      const barrels = {
        clientBarrel: vocabulary.clientBarrelModule,
        serverBarrel: vocabulary.serverBarrelModule,
      };
      // The layer name is passed only on the arm whose message names it. Handing it to the domain
      // arm too would read as if that message had a layer to offer, which is the mistake the split
      // exists to fix.
      if (isDomain) {
        context.report({ node: source, messageId: "domainBarrelImportsServerBarrel", data: barrels });
        return;
      }
      context.report({
        node: source,
        messageId: "clientBarrelImportsServerBarrel",
        data: { ...barrels, controllersLayer: vocabulary.featureLayerDirs.controllers },
      });
    });
  },
});
