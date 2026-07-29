// EXPECT+1: the nesting hangs off the CONSEQUENT branch, not the chained alternate
export const tone = (n: number) => (n > 0 ? (n > 10 ? (n > 100 ? "a" : "b") : "c") : "d");

// EXPECT+2: parenthesised and spread over lines, where a line-at-a-time reader loses it
export const spread = (n: number) =>
  n > 0
    ? "positive"
    : n < -100
      ? "very negative"
      : n < 0
        ? "negative"
        : "zero";

// EXPECT+3: nested inside JSX, where the ternary is an attribute value
export const Badge = ({ n }: { n: number }) => (
  <span
    className={n > 100 ? "a" : n > 50 ? "b" : n > 10 ? "c" : "d"}
  />
);
