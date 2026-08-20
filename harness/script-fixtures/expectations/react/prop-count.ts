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
    // Seven of this component's eight props are declared to the LEFT of the
    // brace, as `Model & { onScanAnother }`. A reader that takes the members
    // between the first `{` and its match scores it at 1 — silent, in the one
    // spelling a component reaches for once its surface is wide.
    "WARN src/features/alpha/ui/wide-intersection.tsx",
    // The same blind spot through `interface XProps extends A, B`, which is a
    // separate site: the base sits in a heritage clause rather than in a type
    // expression, and it is a comma LIST, so a fix resolving one name is still
    // silent here at five.
    "WARN src/features/alpha/ui/wide-extends.tsx",
  ],

  // Each sits one prop under the threshold, one per counting strategy, because a
  // legal neighbour only detects over-counting if it is close enough to the line
  // for the over-count to cross it.
  legal: [
    "src/features/alpha/ui/narrow-neighbour.tsx",
    "src/features/alpha/ui/narrow-typed-neighbour.tsx",
    // The third strategy's neighbour: seven counted across a base and the
    // literal intersected with it, where a re-declared member, a member whose
    // type is a named local type, and a nested object literal each push it over
    // the line if the merge over-reaches.
    "src/features/alpha/ui/narrow-intersection-neighbour.tsx",
  ],
};
