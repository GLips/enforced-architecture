import type { CheckFixtures } from "../../expectations.ts";

export const cssTokensFixtures: CheckFixtures = {
  check: "style/css-tokens",

  // Two files, one matcher each. Held together, either matcher alone kept the
  // file reporting, so breaking the color regex left the suite green.
  obvious: [
    "FAIL src/features/alpha/ui/raw-color.css",
    "FAIL src/features/alpha/ui/raw-font-size.css",
  ],

  // The value wrapped onto the line after its property. A line-oriented matcher
  // — which is the shape this check naturally takes, and the shape the reference
  // implementation has — reports nothing on it. The same file carries a
  // `rgb(var(--x))` that must stay silent, so a color matcher that stops
  // requiring a literal channel shows up here as a second finding.
  adversarial: ["FAIL src/features/alpha/ui/wrapped-font-size.css"],

  legal: [
    // Silent through three separate exemptions, each of them a way the check
    // could start reporting correct code: a `var()` reference, a `--custom-prop`
    // definition, and a relative `em`.
    "src/features/alpha/ui/tokenised.css",
    // The token source, exempt by path — and carrying a raw value outside a
    // custom property, so the path exemption is what keeps it quiet rather than
    // the by-shape skip.
    "src/styles.css",
    // The shadow allowlist. It is not exempt to THIS check and does not need to
    // be: its channels are tokens. A check reading `box-shadow` as a color
    // surface reports it, which is the scope boundary against shadow-source.
    "src/shadows.css",
  ],
};
