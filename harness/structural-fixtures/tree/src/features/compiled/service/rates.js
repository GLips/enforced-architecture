// The COMPILED half, left in the tree by a build step. Reaches `postgres`, so a
// resolver preferring it over its own source turns the clean barrel next door
// into a finding.
import postgres from "postgres";

export const rate = (n) => {
  void postgres;
  return n;
};
