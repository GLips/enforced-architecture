import type { CheckFixtures } from "../../expectations.ts";

export const noKnownValueWideningFixtures: CheckFixtures = {
  check: "types/no-known-value-widening",

  obvious: ["FAIL src/features/alpha/repo/kvw-widened.ts"],

  // Six findings on one path: the wrapped dictionary, the two broad keywords,
  // the class property, the `return`, and the concise arrow. A check that
  // visited only `ReturnStatement` reports four; one that read the arrow's body
  // without unwrapping its parentheses reports five, which is what this file
  // actually did until the count here said otherwise.
  adversarial: [
    "FAIL src/features/alpha/repo/kvw-spellings.ts",
    "FAIL src/features/alpha/repo/kvw-spellings.ts",
    "FAIL src/features/alpha/repo/kvw-spellings.ts",
    "FAIL src/features/alpha/repo/kvw-spellings.ts",
    "FAIL src/features/alpha/repo/kvw-spellings.ts",
    "FAIL src/features/alpha/repo/kvw-spellings.ts",
  ],

  legal: ["src/features/alpha/repo/kvw-closed.ts"],

  // The message quotes the annotation back, and the quote is the actionable
  // half: `satisfies` only helps if the reader is handed the type to write. A
  // check that emitted the sentence with a placeholder — or with the wrong
  // node's text — reports at the same path with the same severity and passes
  // everything above.
  messages: [
    {
      path: "src/features/alpha/repo/kvw-widened.ts",
      contains: "`satisfies Record<string, SettlementHandler>`",
    },
  ],
};
