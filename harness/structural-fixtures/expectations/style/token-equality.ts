import type { CheckFixtures } from "../../expectations.ts";

// Four findings, ONE file. `on-scale-spacing.tsx` carries all four surfaces
// because they are four independent matchers, and the count is the whole
// assertion: comparing paths as a set collapsed them to a single entry, under
// which three of the four could be deleted and the run stayed green.
//
// Which entry stands for which matcher — the paths cannot say it themselves:
//
//   obvious      `gap={16}`          the braced JSX prop value
//   obvious      `padding: 16`       the style-object spacing key
//   adversarial  `radius="6px"`      the quoted JSX prop value
//   adversarial  `borderRadius: 6`   the style-object radius key
export const tokenEqualityFixtures: CheckFixtures = {
  check: "style/token-equality",

  // The two shapes the rule's own doc names, and the two an author writes a
  // matcher for first.
  obvious: [
    "FAIL src/features/alpha/ui/on-scale-spacing.tsx",
    "FAIL src/features/alpha/ui/on-scale-spacing.tsx",
  ],

  // The two the natural matcher misses. A JSX prop written `radius="6px"` is a
  // string where the braced pattern expects a brace, and the radius style keys
  // are a separate closed list from the spacing ones — a check built around
  // spacing props alone passes every obvious case and half of the real ones.
  adversarial: [
    "FAIL src/features/alpha/ui/on-scale-spacing.tsx",
    "FAIL src/features/alpha/ui/on-scale-spacing.tsx",
  ],

  legal: [
    // Off-scale numbers in all four shapes, plus `radius={0}`. This is the
    // neighbour that decides whether the rule is defensible at all: it is only
    // narrow because it stays quiet here, and the zero proves 0 never entered
    // the px map — `none` is 0px on both scales, and a rule rewriting `gap={0}`
    // to a token name would be wrong.
    "src/features/alpha/ui/off-scale-neighbour.tsx",
    // Token-equal numbers inside a comment and inside a string. The comment
    // holds the violation verbatim, so it fires twice if blanking regresses.
    "src/features/alpha/ui/token-prose-neighbour.tsx",
  ],
};
