import type { CheckFixtures } from "../../expectations.ts";

export const barrelPurityFixtures: CheckFixtures = {
  check: "api/barrel-purity",

  // Filed against the BARREL, never the module holding the offending import.
  // The barrel is where the fix lands — move the export to index.server.ts, or
  // put it behind a server function — and pointing at it is half of what the
  // rule teaches. A finding on `service/session.ts` says "this file imports
  // stripe", which is true of every server module in the repo.
  obvious: [
    // index.ts → controllers/payments.ts → service/session.ts → "stripe".
    // Three hops, so a depth-1 implementation reports it clean.
    "FAIL src/features/checkout/index.ts",
  ],

  adversarial: [
    // The same violation with the middle hop written as `@/shared/…`. A trace
    // that follows only relative specifiers ends inside the feature and reports
    // clean — and the aliased spelling is the one the boundary rules REQUIRE of
    // a crossing, so it is how a real chain leaves a feature.
    "FAIL src/features/telemetry/index.ts",
    // A DOMAIN barrel over a module that merely mentions `createServerFn`.
    // Domains are traced without the short-circuit, so a check that applies it
    // everywhere goes silent here while every feature fixture stays green.
    "FAIL src/domains/encryption/index.ts",
    // The chain's middle hop is an `.mts` file. This check spelled its own
    // two-extension resolution list while every walker had eight, so the trace
    // stopped at the hop and the barrel read clean — a hole its own header
    // named and did not close.
    "FAIL src/features/ledger/index.ts",
  ],

  legal: [
    // The server-only leaf sits below a REAL server-function boundary, so the
    // framework strips it from the client bundle and the trace must stop. This
    // is the ordinary way a feature exposes a mutation: a check that fires here
    // gets switched off rather than fixed.
    "src/features/orders/index.ts",
    // The traced module's only `stripe` reference is `import type`. Erased at
    // compile time, so it cannot break a client bundle — and a check reaching
    // for the import graph's reveal pass reports it.
    "src/features/invoices/index.ts",
    // Two modules below the barrel re-export each other. Without a visited set
    // the trace runs to the depth cap and reports the cap against a barrel that
    // imports nothing server-only at all.
    "src/features/loyalty/index.ts",
    // Already in the tree for `placement/topology`: a barrel re-exporting one
    // local module that imports nothing. The trivial case still has to be
    // silent, and it is the only barrel here that predates this check.
    "src/features/scanner/index.ts",
  ],
};
