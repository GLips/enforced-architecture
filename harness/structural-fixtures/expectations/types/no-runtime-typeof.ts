import type { CheckFixtures } from "../../expectations.ts";

export const noRuntimeTypeofFixtures: CheckFixtures = {
  check: "types/no-runtime-typeof",

  obvious: ["FAIL src/features/alpha/repo/rt-parsed.ts"],

  // Five findings on one path: the ternary spelling, the three untyped operands —
  // `unknown`, `any`, `object` — and an untyped RECEIVER, which is the one place
  // a broad `this` surfaces at all, since `types/no-broad-parameters` is silent
  // on the receiver by design. One more decides the exemption's shape: a `typeof`
  // inside a CALLBACK that itself sits inside a type guard. The nearest enclosing
  // function declares no predicate, so it reports; a check that walked outward to
  // any guard exempts it and reports one fewer.
  adversarial: [
    "FAIL src/features/alpha/repo/rt-spellings.ts",
    "FAIL src/features/alpha/repo/rt-spellings.ts",
    "FAIL src/features/alpha/repo/rt-spellings.ts",
    "FAIL src/features/alpha/repo/rt-spellings.ts",
    "FAIL src/features/alpha/repo/rt-spellings.ts",
  ],

  // This entry is the REDESIGN, not decoration. Two of the cases in this file —
  // the SSR guard and the discrimination of `string | number` — are code a
  // SYNTACTIC ban on `typeof` reports and this type-aware check must not. A port
  // carrying that ban passes every positive assertion above and fails only here.
  //
  // Three more cases in it are this check's own line: an operand that is a
  // CONTAINER of nothing or a UNION with a broad member is not an untyped
  // operand, so the tag's shared `typeResolvesToFlags` reading — right for a
  // parameter and a return — is wrong here and this check does not use it. And a
  // `this is T` predicate is a published contract, so the `typeof this` that is
  // its parse step is exempt.
  legal: ["src/features/alpha/repo/rt-legal.ts"],
};
