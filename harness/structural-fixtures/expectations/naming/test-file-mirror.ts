import type { CheckFixtures } from "../../expectations.ts";

export const testFileMirrorFixtures: CheckFixtures = {
  check: "naming/test-file-mirror",

  obvious: ["WARN src/features/mirror/service/edge-cases.test.ts"],

  adversarial: [
    // Both off-convention names sit beside — or read as — ordinary source, so
    // the orphan branch has nothing to say about either. A check built only
    // from the blessed suffixes never sees them, and a project running two test
    // conventions at once looks clean.
    "WARN src/features/mirror/service/pricing.spec.ts",
    "WARN src/features/mirror/service/test_totals.ts",
    // An orphan test written as an ES module. The suffix list once spelled the
    // extension into every entry while the walker accepted eight, so this file
    // was not recognised as a test at all — and the exemption predicate did not
    // recognise it either, so it drew every OTHER rule instead.
    "WARN src/features/mirror/service/orphan-modern.test.mts",
    // The same off-convention `.spec` name as `pricing.spec.ts`, in an extension
    // an extension-listing pattern does not name.
    "WARN src/features/mirror/service/ledgers.spec.mts",
    // An orphan under a directory whose name carries a dot. The qualifier rule
    // reads the last dot of an absolute path, so an ancestor can supply one —
    // and a stripped ancestor sends the sibling lookup somewhere that never
    // exists, which silently clears the orphan.
    "WARN src/features/mirror/service/legacy.v2/rates.test.ts",
  ],

  // This check fails loudest in the over-matching direction — it warns on files
  // that are named correctly — and that defect is invisible to every positive
  // case above.
  legal: [
    "src/features/mirror/service/invoices.test.ts",
    "src/features/mirror/service/receipts.test.ts",
    "src/features/mirror/service/imports.integration.test.ts",
    // A correctly-named .mts test beside its .mts module: recognised as a test,
    // and its sibling found across a different extension than its own.
    "src/features/mirror/service/ledgers.test.mts",
    // A cross-cutting suite with no module of its name, in a test directory.
    // The only thing that keeps it quiet is the shared directory convention —
    // which replaced a config list of allowed orphan directories.
    "src/features/mirror/__tests__/checkout-flow.test.ts",
    // An orphan test in a generated DIRECTORY. This check waives the test
    // exemption to see its subject; waiving the generated one along with it
    // produces a finding whose fix the next codegen run undoes.
    "src/gen/orphan-generated.test.ts",
  ],
};
