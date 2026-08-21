import type { CheckFixtures } from "../../expectations.ts";

export const noKnownValueWideningFixtures: CheckFixtures = {
  check: "types/no-known-value-widening",

  obvious: ["FAIL src/features/alpha/repo/kvw-widened.ts"],

  // Four findings on the dictionary path — the wrapped dictionary, the class
  // property, the `return`, and the concise arrow — plus the two broad keywords,
  // which live in their own file because their finding says something different.
  // A check that visited only `ReturnStatement` reports two of the four; one that
  // read the arrow's body without unwrapping its parentheses reports three, which
  // is what this file actually did until the count here said otherwise.
  adversarial: [
    "FAIL src/features/alpha/repo/kvw-spellings.ts",
    "FAIL src/features/alpha/repo/kvw-spellings.ts",
    "FAIL src/features/alpha/repo/kvw-spellings.ts",
    "FAIL src/features/alpha/repo/kvw-spellings.ts",
    "FAIL src/features/alpha/repo/kvw-broad-keyword.ts",
    "FAIL src/features/alpha/repo/kvw-broad-keyword.ts",
  ],

  legal: ["src/features/alpha/repo/kvw-closed.ts"],

  // TWO branches, two prescriptions, and the split is load-bearing rather than
  // stylistic. `satisfies Record<…>` checks the values without opening the key
  // domain and is the fix for a dictionary; `satisfies unknown` compiles, checks
  // nothing, and leaves the loss exactly where it was. One sentence delivered to
  // both branches passes every count and path assertion above, so the two
  // `absent` entries are the whole guard — each says the other branch's sentence
  // does not reach this reader.
  messages: [
    {
      path: "src/features/alpha/repo/kvw-widened.ts",
      contains: "`satisfies Record<string, SettlementHandler>`",
    },
    {
      path: "src/features/alpha/repo/kvw-widened.ts",
      absent: "states no contract",
    },
    {
      path: "src/features/alpha/repo/kvw-broad-keyword.ts",
      contains: "which states no contract",
    },
    {
      path: "src/features/alpha/repo/kvw-broad-keyword.ts",
      absent: "satisfies",
    },
  ],
};
