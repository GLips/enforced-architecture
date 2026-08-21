import type { CheckFixtures } from "../../expectations.ts";

export const noOpaqueRecordFixtures: CheckFixtures = {
  check: "types/no-opaque-record",

  obvious: ["FAIL src/features/alpha/repo/opaque-record-bag.ts"],

  // Six findings on ONE path, and the multiplicity is the assertion: the file
  // holds seven bag-shaped declarations and the seventh is an alias to one
  // already reported. A check that stopped resolving names reports seven and
  // fails here; a check that stopped matching one spelling reports five and
  // fails here too. Neither is visible to a comparison of bare paths.
  adversarial: [
    "FAIL src/features/alpha/repo/opaque-record-spellings.ts",
    "FAIL src/features/alpha/repo/opaque-record-spellings.ts",
    "FAIL src/features/alpha/repo/opaque-record-spellings.ts",
    "FAIL src/features/alpha/repo/opaque-record-spellings.ts",
    "FAIL src/features/alpha/repo/opaque-record-spellings.ts",
    "FAIL src/features/alpha/repo/opaque-record-spellings.ts",

    // The two bags in `bag-widening.ts`, which is `types/no-widen-then-assert`'s
    // fixture as much as this one's: an open dictionary with an opaque value is
    // a bag here and a widening target there. Both report, and the two messages
    // are jointly actionable — stop widening, and name the fields — so this is
    // an overlap the catalog allows rather than two owners of one policy.
    "FAIL src/features/alpha/repo/bag-widening.ts",
    "FAIL src/features/alpha/repo/bag-widening.ts",

    // The ambient bypass, pinned. `AmbientSettlementBag` is declared in a
    // `.d.ts` nothing walks, so this USE is the only line a run will ever look
    // at. A check that asks "is the declaration in the program" instead of "is
    // it in a file I walk" stays quiet here and hands every adopter a one-alias
    // off-switch for the whole rule.
    "FAIL src/features/alpha/repo/opaque-record-ambient.ts",
  ],

  legal: ["src/features/alpha/repo/opaque-record-closed.ts"],

  // The two messages differ by which recovery they name first, and the split is
  // load-bearing: `Record<string, unknown>` and `{ [k: string]: unknown }` are
  // the same type, so a reader who was shown the wrong one is being told to
  // rewrite a spelling they did not use. Nothing above can tell the two apart —
  // both branches report `FAIL` at the same path.
  messages: [
    {
      path: "src/features/alpha/repo/opaque-record-bag.ts",
      contains: "Record<string, unknown> is an untyped bag",
    },
    {
      path: "src/features/alpha/repo/opaque-record-bag.ts",
      absent: "spelled differently",
    },
    {
      path: "src/features/alpha/repo/opaque-record-spellings.ts",
      contains: "An index signature with an unknown/any value",
    },
  ],
};
