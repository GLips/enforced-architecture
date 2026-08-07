import type { CheckFixtures } from "../../expectations.ts";

export const propCountFixtures: CheckFixtures = {
  check: "react/prop-count",

  // A named XProps interface, one member per line, counted straight. Also the
  // only fixture outside `features/*/ui`, so a target glob that stopped
  // resolving shows up as a miss here rather than as a clean run.
  obvious: ["WARN src/shared/ui/wide-plain.tsx"],

  adversarial: [
    // Generic, multi-line signature, no named Props type — three separate blind
    // spots, and the counted region has to stop at the destructure's own closing
    // brace or the inline type literal after it doubles every name.
    "WARN src/features/alpha/ui/wide-generic.tsx",
    // The other strategy: nine members in a named interface, six of them
    // arrow-typed. An arrow ends in `>`, and a depth counter treating that as a
    // closing bracket merges the remaining members and scores this under the
    // threshold — silent, which is the failure this tier keeps producing.
    "WARN src/features/alpha/ui/wide-typed.tsx",
  ],

  // Both sit one prop under the threshold, one per counting strategy, because a
  // legal neighbour only detects over-counting if it is close enough to the line
  // for the over-count to cross it.
  legal: [
    "src/features/alpha/ui/narrow-neighbour.tsx",
    "src/features/alpha/ui/narrow-typed-neighbour.tsx",
  ],
};
