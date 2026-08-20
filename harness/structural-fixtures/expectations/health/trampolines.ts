import type { CheckFixtures } from "../../expectations.ts";

export const trampolinesFixtures: CheckFixtures = {
  check: "health/trampolines",

  obvious: ["WARN src/features/relay/service/relay-forwarding.ts"],

  adversarial: [
    // Twice, and the multiplicity is the assertion: an implementation that
    // finds the first method of an exported object and stops reads as working.
    "WARN src/features/relay/service/relay-namespace.ts",
    "WARN src/features/relay/service/relay-namespace.ts",
    // Signature and body both spanning lines, so a line-oriented matcher loses
    // the boundary and reports nothing — which looks like a clean file.
    "WARN src/features/relay/service/relay-wide-signature.ts",
  ],

  legal: [
    // Behaviour keywords in the body, and an object-literal return type that
    // has none. Reading the type as the body reports this file.
    "src/features/relay/service/relay-policy.ts",
    // Trampolines by body, legal by layer. Wrapping the query IS the repo
    // layer's job, so this fires the moment the layer scoping slips.
    "src/features/relay/repo/relay-records.ts",
  ],
};
