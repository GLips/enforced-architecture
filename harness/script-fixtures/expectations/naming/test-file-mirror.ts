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
  ],

  // This check fails loudest in the over-matching direction — it warns on files
  // that are named correctly — and that defect is invisible to every positive
  // case above.
  legal: [
    "src/features/mirror/service/invoices.test.ts",
    "src/features/mirror/service/receipts.test.ts",
    "src/features/mirror/service/imports.integration.test.ts",
  ],
};
