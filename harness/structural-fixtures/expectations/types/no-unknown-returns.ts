import type { CheckFixtures } from "../../expectations.ts";

export const noUnknownReturnsFixtures: CheckFixtures = {
  check: "types/no-unknown-returns",

  obvious: ["FAIL src/features/alpha/repo/ur-unknown.ts"],

  // Five findings on one path: `Promise<unknown>`, `unknown[]`, `any`, a
  // method signature on an INTERFACE, and an arrow. A check that unwrapped no
  // containers reports three; one that walked only function declarations
  // reports four. Both pass a comparison of bare paths.
  adversarial: [
    "FAIL src/features/alpha/repo/ur-spellings.ts",
    "FAIL src/features/alpha/repo/ur-spellings.ts",
    "FAIL src/features/alpha/repo/ur-spellings.ts",
    "FAIL src/features/alpha/repo/ur-spellings.ts",
    "FAIL src/features/alpha/repo/ur-spellings.ts",
  ],

  legal: ["src/features/alpha/repo/ur-legal.ts"],
};
