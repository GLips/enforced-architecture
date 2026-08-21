import type { CheckFixtures } from "../../expectations.ts";

export const shadowSourceFixtures: CheckFixtures = {
  check: "style/shadow-source",

  // The CSS property in a stylesheet — the surface the lint tier cannot see at
  // all, and the one the rule's doc names. Its header mentions `box-shadow` in
  // a block comment, so a check that matches raw text reports it twice and the
  // multiset count says so.
  obvious: ["FAIL src/features/alpha/ui/stray-shadow.css"],

  // The JS key. A separate branch, selected by extension, so a CSS-only
  // implementation is silent here while looking entirely correct against the
  // obvious case — the whole reason this tier needs an adversarial kind.
  adversarial: [
    "FAIL src/features/alpha/ui/inline-shadow.tsx",
    // The same JS key in an extension a configured scan list does not name. What
    // is READ is not a knob: a list that can be emptied is the check switched
    // off with the config still listing it.
    "FAIL src/features/alpha/ui/modern-shadow.mts",
  ],

  legal: [
    // The curated allowlist itself. It holds a real `box-shadow`, so it is the
    // one fixture that proves the skip: without it the rule fires on its own
    // inventory and the message points at a file the rule rejects.
    "src/shadows.css",
    // `shadowRoot`, `data-shadow`, and a class name — the word "shadow" in
    // three places that are not the property.
    "src/features/alpha/ui/shadow-word-neighbour.tsx",
  ],
};
