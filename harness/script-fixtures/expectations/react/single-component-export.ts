import type { CheckFixtures } from "../../expectations.ts";

export const singleComponentExportFixtures: CheckFixtures = {
  check: "react/single-component-export",

  obvious: ["WARN src/features/alpha/ui/two-components.tsx"],

  adversarial: [
    // Neither pair below is visible to a matcher keyed on `export function
    // Name(`, and a file it cannot read scores one component or zero — which
    // reports nothing, exactly like a file that was fine.
    "WARN src/features/alpha/ui/default-export-pair.tsx",
    "WARN src/features/alpha/ui/generic-arrow-pair.tsx",
  ],

  // This rule fails in both directions, and over-matching is the direction that
  // trains people to ignore it, so both legal neighbours are load-bearing.
  legal: [
    "src/features/alpha/ui/compound-neighbour.tsx",
    "src/features/alpha/ui/single-component-neighbour.tsx",
  ],
};
