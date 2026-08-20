import type { CheckFixtures } from "../../expectations.ts";

export const layerDirectionFixtures: CheckFixtures = {
  check: "placement/layer-direction",

  obvious: [
    // repo reaching one rung up into service, spelled `../service/…`. The only
    // upward edge a specifier pattern gets right, kept as the regression guard.
    "FAIL src/features/layers/repo/plain-upward.ts",
  ],

  adversarial: [
    // The identical edge from one directory deeper, spelled `../../service/…`.
    // A pattern expecting one `../` before the layer name never fires.
    "FAIL src/features/layers/repo/nested/deep.ts",
    // The identical edge again, written as an alias. A relative-only matcher
    // has nothing to key on, and this is the spelling a project's own
    // conventions encourage — so it is the form an upward edge survives in.
    "FAIL src/features/layers/repo/root.ts",
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
  ],
};
