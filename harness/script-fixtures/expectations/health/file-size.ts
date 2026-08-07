import type { CheckFixtures } from "../../expectations.ts";

export const fileSizeFixtures: CheckFixtures = {
  check: "health/file-size",

  // Two thresholds, and both severities are the point: comparing paths alone
  // accepted the hard limit being demoted to a warning without a word.
  obvious: ["FAIL src/features/alpha/service/oversized.ts"],

  adversarial: [
    // Between the warn threshold and the hard limit, so it must only WARN. A
    // single fixture past both leaves the warn branch unproven.
    "WARN src/features/alpha/service/large-neighbour.ts",
    // The SECOND declared root. Every other fixture in this tree lives under
    // `src`, so `packages/core/src` was declared and never exercised — and a
    // check pointed at a path that does not exist returns cleanly by design, so
    // an unexercised root is indistinguishable from a working one.
    "FAIL packages/core/src/oversized-core.ts",
  ],

  // Under both thresholds and read by other checks, so it also proves the walk
  // reaches ordinary files rather than only the generated ones.
  legal: ["src/features/alpha/service/alpha-thing.ts"],

  // The length IS the content of these tests, so they are stated as numbers and
  // materialised for the duration of the run. Storing them cost ~1,750 lines of
  // `export const bulkAlpha1 = 1;` that nobody reads and every grep wades through.
  generated: [
    { path: "src/features/alpha/service/oversized.ts", lines: 616, symbol: "bulkAlpha" },
    { path: "src/features/alpha/service/large-neighbour.ts", lines: 525, symbol: "warnAlpha" },
    { path: "packages/core/src/oversized-core.ts", lines: 612, symbol: "coreBulk" },
  ],
};
