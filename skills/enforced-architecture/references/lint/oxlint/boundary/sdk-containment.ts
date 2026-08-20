// ─── boundary/sdk-containment ─────────────────────────────────────────
//
// Makes sure: A package with a row on the owner table is imported only in the
// modules that own it. To change the Stripe API version, or to drop a field from
// the analytics payload, you open one file, and the call sites you find are all
// of them. A UI file cannot construct the server SDK, so its secret key stays
// out of the browser bundle.
//
// This is deliberately NOT a row in `arch/import-policy`'s table. That table is
// keyed by area; this policy is keyed by exact package and exact module. One
// table for both forces `domain → package` to state that a domain may import any
// package — a cell that says something untrue so the machinery can work.
//
// NEGATIVE SPACE: a package with no row is UNCONSTRAINED, and this rule cannot
// detect that state. Whether a package reaches a network, a keychain or a
// filesystem is a judgement, not something a check decides; the nearest
// mechanical proxy flags React and still misses the first bad import. A new SDK
// needs its row, and nothing reminds you.
//
// NEGATIVE SPACE: there is no entrypoint exemption and no way to spell one. An
// entrypoint that genuinely has to set an SDK up owns it, and says so on that
// package's `owners` list — a decision one row records, rather than a category of
// file that inherits a pass. A filename that inherits a pass exempts every import
// in the file, not the one import the entrypoint needs.
// ──────────────────────────────────────────────────────────────────────

import { defineRule } from "@oxlint/plugins";
import { classifyFileRole } from "../../policy/declared-trees.ts";
import { aliasSpecifierFor, classifySpecifier } from "../../policy/layout.ts";
import { PACKAGE_OWNERS } from "../../policy/package-owners.ts";
import { visitModuleSources } from "../lib/module-source-visitor.ts";

export const sdkContainmentRule = defineRule({
  meta: {
    type: "problem",
    messages: {
      // Names its owners and prescribes no import, deliberately. "Import the
      // wrapper from infrastructure instead" is a fix `arch/import-policy` also
      // forbids from a domain or a service, and a pair of diagnostics that each
      // forbid the other's fix is an edit loop. Read with the purity message,
      // this resolves to "the dependency has to be supplied from above".
      rawSdkOutsideOwner: "{{package}} may only be imported by {{ownerNames}}. {{why}}",
    },
  },
  create(context) {
    const role = classifyFileRole(context.filename);
    if (role === undefined) return {};
    const { vocabulary } = role.tree;

    // An owning module is exempt for its OWN package only, which is what keeps the
    // wrapper layer from becoming one permission: the payments adapter has no
    // business opening the analytics client.
    //
    // Compared as a WHOLE path from the tree's source root, which is what the
    // `/src/`-anchored suffix match it replaces was reaching for: `stripe-legacy.ts`
    // must not inherit `stripe.ts`'s exemption, and neither must a same-named file
    // somewhere else in the repo.
    const contained = PACKAGE_OWNERS.filter(
      (row) => !row.owners.includes(role.sourcePath),
    );
    if (contained.length === 0) return {};

    return visitModuleSources((source, specifier) => {
      // Which specifiers name a PACKAGE is `lint/policy/layout.ts`'s answer, not
      // this rule's. Only the policy KEY is different here — exact package and
      // exact module rather than area — and re-deriving the vocabulary underneath
      // it is how a rule ends up disagreeing with the tier it sits in: an inline
      // `startsWith(".")` test reads `@/foo` as a package named `@/foo`, because
      // an alias is neither relative nor bare.
      const target = classifySpecifier(vocabulary, specifier);
      if (target?.kind !== "package") return;

      for (const row of contained) {
        if (row.package !== target.name) continue;
        context.report({
          node: source,
          messageId: "rawSdkOutsideOwner",
          data: {
            package: specifier,
            ownerNames: row.owners
              .map((owner) => aliasSpecifierFor(vocabulary, owner))
              .join(" or "),
            why: row.why,
          },
        });
      }
    });
  },
});
