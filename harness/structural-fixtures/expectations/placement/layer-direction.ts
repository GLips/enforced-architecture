import type { CheckFixtures } from "../../expectations.ts";

export const layerDirectionFixtures: CheckFixtures = {
  check: "placement/layer-direction",

  obvious: [
    // repo reaching one rung up into service, spelled `../service/…`. The only
    // upward edge a specifier pattern gets right, kept as the regression guard.
    "FAIL src/features/layers/repo/plain-upward.ts",
    // A layer importing its own feature's BARREL. The sharpest upward edge a
    // feature can contain — the barrel re-exports every layer, so the importer
    // takes on all of them at once and the cycle runs through the file that
    // describes the feature from outside.
    "FAIL src/features/orders/ui/barrel-upward.ts",
  ],

  adversarial: [
    // The identical edge from one directory deeper, spelled `../../service/…`.
    // A pattern expecting one `../` before the layer name never fires.
    "FAIL src/features/layers/repo/nested/deep.ts",
    // The identical edge again, written as an alias. A relative-only matcher
    // has nothing to key on, and this is the spelling a project's own
    // conventions encourage — so it is the form an upward edge survives in.
    "FAIL src/features/layers/repo/root.ts",
    // The barrel edge in its aliased spelling, which is what auto-import writes.
    // It is also the spelling `boundary/import-policy` never sees, because an
    // aliased specifier belongs to the linter — so without this arm the edge is
    // governed by nothing in either tier.
    "FAIL src/features/orders/ui/barrel-alias-upward.ts",
    // The same barrel edge from a file at the FEATURE ROOT, which sits in no
    // layer. `index.ts` re-exports it, so the cycle is identical — and an arm
    // gated on the source HAVING a layer waves it past, which reads as "the
    // barrel is safe from the feature root". The guard has to exclude a barrel
    // importing a barrel instead; `index.server.ts` re-exporting `index.ts` is
    // the legal edge it must not catch.
    "FAIL src/features/orders/errors.ts",
  ],

  legal: [
    // The downward import, character for character the specifier the obvious
    // case is reported for. Only the importing file's layer separates them.
    "src/features/layers/ui/downward-neighbour.ts",
    // Sideways, exactly on the line. Comparing ranks with `>=` rather than `>`
    // reports it, and no upward fixture can reveal that.
    "src/features/layers/service/same-layer-neighbour.ts",
    // A layer on one end only. An absent layer picks up a rank by accident —
    // -1 from `indexOf`, or 0 if it is treated as the top — and either one
    // invents a violation here.
    "src/features/layers/ui/layerless-neighbour.ts",
    // The feature-root file the case above imports. Nothing else in the tree
    // produces a half-layered edge, so its deletion would remove that coverage
    // silently rather than fail a comparison.
    "src/features/layers/errors.ts",
    // ANOTHER feature's barrel, imported from a layer. That is the ordinary way
    // one feature uses another, and the barrel arm has to tell it from a
    // feature's own — an arm that compares the path shape rather than the
    // feature name reports every cross-feature import in the repo.
    "src/features/consumer/service/uses-provider.ts",
  ],
};
