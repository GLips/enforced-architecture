export const Row = () => (
  <span
    // EXPECT+1: a string value with a unit, not a bare number
    style={{ fontSize: "0.8125rem" }}
  />
);

export const styles = {
  // EXPECT: a computed value, where a numeric-literal pattern would miss
  fontSize: 13 * 1.2,
  // EXPECT: a SECOND occurrence in the same file, which needs per-match scoping
  fontSize: "12px",
};
