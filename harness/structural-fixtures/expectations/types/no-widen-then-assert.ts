import type { CheckFixtures } from "../../expectations.ts";

export const noWidenThenAssertFixtures: CheckFixtures = {
  check: "types/no-widen-then-assert",

  obvious: ["FAIL src/features/alpha/repo/wta-roundtrip.ts"],

  // Five findings over two paths, and two of them are coverage no syntactic
  // matcher can have: the WRAPPED dictionary, and the widening whose evidence is
  // a CALL's return type. A check reading the syntax rather than the type
  // reports three here and passes a comparison of bare paths.
  //
  // `bag-widening.ts` is the pair `types/no-opaque-record` also reports on. It
  // is a separate file for exactly that reason — the tree's rule is that a
  // fixture two checks fire on is named for the overlap, not folded into one
  // check's file and then quietly added to the other's list.
  adversarial: [
    "FAIL src/features/alpha/repo/wta-spellings.ts",
    "FAIL src/features/alpha/repo/wta-spellings.ts",
    "FAIL src/features/alpha/repo/wta-spellings.ts",
    "FAIL src/features/alpha/repo/bag-widening.ts",
    "FAIL src/features/alpha/repo/bag-widening.ts",
  ],

  legal: ["src/features/alpha/repo/wta-legal.ts"],

  // The message names the BINDING, because the fix is to delete that binding
  // and the reader has to know which one. A check that lost the name still
  // reports the same line with the same severity.
  messages: [
    {
      path: "src/features/alpha/repo/wta-roundtrip.ts",
      contains: "`widened` had a known type",
    },
  ],
};
