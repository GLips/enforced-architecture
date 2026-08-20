// ─── boundary/sdk-containment ─────────────────────────────────────────
//
// Tag:       boundary
// Mechanism: oxlint JS plugin (per-file, real-time)
// Blocking:  Yes
//
// Prevents: A third-party SDK being imported anywhere but the module that owns
//           it. The rest of the app talks to the capability that module exposes.
//
// The point is not tidiness: it is that "replace the payments vendor" or "stop
// sending this field" should be one file to open, not a search whose completeness
// nobody can vouch for. It also gives the capability somewhere to grow — when a
// feature first needs to record an event, this rule sends it to the wrapper,
// where what the app records, and what it deliberately does not, gets decided
// once instead of at each call site.
//
// Applies:  All src/** files EXCEPT test files, scripts, and — per package — the
//           modules that package's row names as its owners.
//
// The policy is `PACKAGE_OWNERS` in `lint/policy/package-owners.ts`, which is
// also where the argument for what belongs on it lives. This file is the reader:
// it decides which rows apply to the file being linted, and matches a specifier
// to a package by canonical name so a subpath cannot step around a row.
//
// This is deliberately NOT a row in `arch/import-policy`'s table. That table is
// keyed by area; this policy is keyed by exact package and exact module, and the
// ordering that would let one table express both forces `domain → package` to
// claim a domain may import any package — a cell stating something untrue so the
// machinery could work.
//
// NEGATIVE SPACE: a package with no row is UNCONSTRAINED, and this rule cannot
// detect that state. Whether a package reaches a network, a keychain or a
// filesystem is a judgement, not something a check decides; the nearest
// mechanical proxy would flag React while still missing the first bad import.
// Adding an SDK means adding the row — nothing reminds you.
//
// NEGATIVE SPACE: there is no entrypoint exemption and no way to spell one. An
// entrypoint that genuinely has to set an SDK up owns it, and says so by
// appearing on that package's `owners` list — a decision one row records rather
// than a category of file that inherits a pass. A filename that inherits a pass
// is a bypass vector: it exempts every import in the file, not the one the
// entrypoint needed.
//
// ── Adapt ─────────────────────────────────────────────────────────────
//
// The rows, and the reasoning about what earns one, are in
// `lint/policy/package-owners.ts`. Nothing in this file is configuration.
//
// Registration: `rules: { "sdk-containment": sdkContainmentRule }` in
// `lint/oxlint/plugin.ts`, and `"arch/sdk-containment": "error"` in `.oxlintrc.json`.
//
// ──────────────────────────────────────────────────────────────────────

import { defineRule } from "@oxlint/plugins";
import { classifySpecifier, SOURCE_ROOT } from "../../policy/layout.ts";
import { PACKAGE_OWNERS } from "../../policy/package-owners.ts";
import { isArchitectureExemptPath } from "../lib/architecture-exempt-paths.ts";
import { visitModuleSources } from "../lib/module-source-visitor.ts";

/**
 * Anchored at both ends. The leading separator is what stops
 * `stripe-legacy.ts` from inheriting `stripe.ts`'s exemption, and the source root
 * is what stops a same-named file somewhere else in the repo from claiming it.
 */
function isOwner(filename: string, owner: string): boolean {
  return filename.endsWith(`/${SOURCE_ROOT}/${owner}`);
}

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
    const { filename } = context;
    if (isArchitectureExemptPath(filename)) return {};

    // An owning module is exempt for its OWN package only, which is what keeps the
    // wrapper layer from becoming one permission: the payments adapter has no
    // business opening the analytics client.
    const contained = PACKAGE_OWNERS.filter(
      (row) => !row.owners.some((owner) => isOwner(filename, owner)),
    );
    if (contained.length === 0) return {};

    return visitModuleSources((source, specifier) => {
      // Which specifiers name a PACKAGE is `lint/policy/layout.ts`'s answer, not
      // this rule's. Only the policy KEY is different here — exact package and
      // exact module rather than area — and re-deriving the vocabulary underneath
      // it is how a rule ends up disagreeing with the tier it sits in: an inline
      // `startsWith(".")` test reads `@/foo` as a package named `@/foo`, because
      // an alias is neither relative nor bare.
      const target = classifySpecifier(specifier);
      if (target?.kind !== "package") return;

      for (const row of contained) {
        if (row.package !== target.name) continue;
        context.report({
          node: source,
          messageId: "rawSdkOutsideOwner",
          data: {
            package: specifier,
            ownerNames: row.owners.map((owner) => `${SOURCE_ROOT}/${owner}`).join(" or "),
            why: row.why,
          },
        });
      }
    });
  },
});
