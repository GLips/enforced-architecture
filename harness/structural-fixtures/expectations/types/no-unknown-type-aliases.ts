import type { CheckFixtures } from "../../expectations.ts";

export const noUnknownTypeAliasesFixtures: CheckFixtures = {
  check: "types/no-unknown-type-aliases",

  obvious: ["FAIL src/features/alpha/repo/uta-unknown.ts"],

  // Six findings on one path, and the count is the assertion three times over.
  // The CHAIN reports at both links — a check that resolved only the written
  // body reports the first and not the second. One alias is declared INSIDE a
  // function, which a walk over top-level statements never reaches. And one is
  // GENERIC while ignoring its parameter, which the obvious `typeParameters`
  // early-out silences; that early-out was written, found to change no other
  // verdict in this tree, and deleted.
  adversarial: [
    "FAIL src/features/alpha/repo/uta-spellings.ts",
    "FAIL src/features/alpha/repo/uta-spellings.ts",
    "FAIL src/features/alpha/repo/uta-spellings.ts",
    "FAIL src/features/alpha/repo/uta-spellings.ts",
    "FAIL src/features/alpha/repo/uta-spellings.ts",
    "FAIL src/features/alpha/repo/uta-spellings.ts",
  ],

  legal: ["src/features/alpha/repo/uta-legal.ts"],

  // The message names the alias, which is the whole address of the fix: the
  // finding sits on a declaration whose name is the thing to change.
  messages: [
    {
      path: "src/features/alpha/repo/uta-unknown.ts",
      contains: "Type alias `SettlementPayload`",
    },
  ],
};
