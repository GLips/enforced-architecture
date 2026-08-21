import type { CheckFixtures } from "../../expectations.ts";

export const noRuntimeTypeofFixtures: CheckFixtures = {
  check: "types/no-runtime-typeof",

  obvious: ["FAIL src/features/alpha/repo/rt-parsed.ts"],

  // Four findings on one path: the ternary spelling, and the three untyped
  // operands — `unknown`, `any`, `object`. The fourth is the one that decides
  // the exemption's shape: a `typeof` inside a CALLBACK that itself sits inside
  // a type guard. The nearest enclosing function declares no predicate, so it
  // reports; a check that walked outward to any guard exempts it and reports
  // three.
  adversarial: [
    "FAIL src/features/alpha/repo/rt-spellings.ts",
    "FAIL src/features/alpha/repo/rt-spellings.ts",
    "FAIL src/features/alpha/repo/rt-spellings.ts",
    "FAIL src/features/alpha/repo/rt-spellings.ts",
  ],

  // This entry is the REDESIGN, not decoration. Two of the three cases in this
  // file — the SSR guard and the discrimination of `string | number` — are code
  // the oxlint-tier predecessor reported and named in its own header as code it
  // wrongly reported. A port that kept the syntactic ban passes every positive
  // assertion above and fails only here.
  legal: ["src/features/alpha/repo/rt-legal.ts"],
};
