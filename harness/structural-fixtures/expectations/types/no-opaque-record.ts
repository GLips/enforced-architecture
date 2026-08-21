import type { CheckFixtures } from "../../expectations.ts";

export const noOpaqueRecordFixtures: CheckFixtures = {
  check: "types/no-opaque-record",

  obvious: ["FAIL src/features/alpha/service/opaque-record-bag.ts"],

  // Six findings on ONE path, and the multiplicity is the assertion: the file
  // holds seven bag-shaped declarations and the seventh is an alias to one
  // already reported. A check that stopped resolving names reports seven and
  // fails here; a check that stopped matching one spelling reports five and
  // fails here too. Neither is visible to a comparison of bare paths.
  adversarial: [
    "FAIL src/features/alpha/service/opaque-record-spellings.ts",
    "FAIL src/features/alpha/service/opaque-record-spellings.ts",
    "FAIL src/features/alpha/service/opaque-record-spellings.ts",
    "FAIL src/features/alpha/service/opaque-record-spellings.ts",
    "FAIL src/features/alpha/service/opaque-record-spellings.ts",
    "FAIL src/features/alpha/service/opaque-record-spellings.ts",
  ],

  legal: ["src/features/alpha/service/opaque-record-closed.ts"],

  // The two messages differ by which recovery they name first, and the split is
  // load-bearing: `Record<string, unknown>` and `{ [k: string]: unknown }` are
  // the same type, so a reader who was shown the wrong one is being told to
  // rewrite a spelling they did not use. Nothing above can tell the two apart —
  // both branches report `FAIL` at the same path.
  messages: [
    {
      path: "src/features/alpha/service/opaque-record-bag.ts",
      contains: "Record<string, unknown> is an untyped bag",
    },
    {
      path: "src/features/alpha/service/opaque-record-bag.ts",
      absent: "spelled differently",
    },
    {
      path: "src/features/alpha/service/opaque-record-spellings.ts",
      contains: "An index signature with an unknown/any value",
    },
  ],
};
