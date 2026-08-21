import type { CheckFixtures } from "../../expectations.ts";

export const noBroadParametersFixtures: CheckFixtures = {
  check: "types/no-broad-parameters",

  obvious: ["FAIL src/features/alpha/repo/bp-untyped.ts"],

  // Thirteen findings on one path, and the count is doing four jobs at once.
  //
  // The GUARD there vouches for `value` and NOT for `extra`, so a check that
  // exempted the whole function once it saw a predicate reports twelve — that is
  // what stops `value is T` from being a blanket hatch. One parameter buries
  // `unknown` in a UNION, the only row in this tree pinning `typeResolvesToFlags`'
  // union arm. Two more are the `ReadonlyArray` and `PromiseLike` entries of
  // `TRANSPARENT_CONTAINER_NAMES`, which nothing else reaches: that set is a
  // COVERAGE list, so an adopter shortening it is turning a check off, and this
  // count is the only place that shows. And one nests five containers deep, which
  // a walk that stops unwrapping any shallower answers "not broad" for, silently.
  adversarial: [
    "FAIL src/features/alpha/repo/bp-spellings.ts",
    "FAIL src/features/alpha/repo/bp-spellings.ts",
    "FAIL src/features/alpha/repo/bp-spellings.ts",
    "FAIL src/features/alpha/repo/bp-spellings.ts",
    "FAIL src/features/alpha/repo/bp-spellings.ts",
    "FAIL src/features/alpha/repo/bp-spellings.ts",
    "FAIL src/features/alpha/repo/bp-spellings.ts",
    "FAIL src/features/alpha/repo/bp-spellings.ts",
    "FAIL src/features/alpha/repo/bp-spellings.ts",
    "FAIL src/features/alpha/repo/bp-spellings.ts",
    "FAIL src/features/alpha/repo/bp-spellings.ts",
    "FAIL src/features/alpha/repo/bp-spellings.ts",
    "FAIL src/features/alpha/repo/bp-spellings.ts",
  ],

  legal: ["src/features/alpha/repo/bp-legal.ts"],

  // Two branches with two sentences, and they prescribe different edits:
  // `unknown` is told to parse at the boundary, `object` is told to name a
  // type — parsing an `object` is not the fix and would read as noise. Both
  // branches fire at `bp-spellings.ts`, so one `contains` per branch, and the
  // `absent` on the obvious fixture is the only entry that says the `object`
  // sentence is NARROW rather than appended to every finding.
  messages: [
    {
      path: "src/features/alpha/repo/bp-spellings.ts",
      contains: "accepts a value without saying what it is",
    },
    {
      path: "src/features/alpha/repo/bp-spellings.ts",
      contains: "uses the broad `object` type",
    },
    {
      path: "src/features/alpha/repo/bp-untyped.ts",
      absent: "broad `object` type",
    },
  ],
};
