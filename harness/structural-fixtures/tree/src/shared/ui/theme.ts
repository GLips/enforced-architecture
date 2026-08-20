// The fixture tree's token source. `style/token-equality` imports these rather
// than restating them, which is the whole reason that check is a script: an
// enforcer that reads the scale cannot drift from it.
//
// The values are chosen so the off-scale neighbour has room to miss. Spacing
// lands on 10/12/16/20/32 px and radius on 2/4/6/8/12 px, so 7 and 5 are
// unambiguously off both scales.
//
// `none` is here on purpose. It collapses to 0, and 0 is dropped when the px
// maps are built — a rule that rewrote `gap={0}` to a token would be wrong,
// because 0 is a no-op rather than a spacing decision.

export const spacing = {
  none: "0px",
  xs: "0.625rem",
  sm: "0.75rem",
  md: "1rem",
  lg: "1.25rem",
  xl: "2rem",
};

export const radius = {
  none: "0px",
  xs: "2px",
  sm: "4px",
  md: "6px",
  lg: "8px",
  xl: "12px",
};
