import { describeRule } from "../lib/rule-spec.ts";
import { noTestImportsRule } from "./no-test-imports.ts";

const SERVICE = "/repo/src/features/billing/service/charge.ts";
const REPO_LAYER = "/repo/src/features/billing/repo/queries.ts";

describeRule("boundary/no-test-imports", noTestImportsRule, {
  obvious: [
    {
      name: "production code importing a sibling spec",
      filename: SERVICE,
      code: `import { makeInvoice } from "./charge.test";\nexport const charge = () => makeInvoice();`,
      errors: [{ messageId: "testImport" }],
    },
    {
      name: "production code importing shared test infrastructure by alias",
      filename: REPO_LAYER,
      code: `import { seedDb } from "@/test/seed";`,
      errors: [{ messageId: "testImport" }],
    },
    {
      name: "production code importing a __tests__ directory",
      filename: REPO_LAYER,
      code: `import { fakeRow } from "../__tests__/fixtures";`,
      errors: [{ messageId: "testImport" }],
    },
  ],

  adversarial: [
    {
      name: "a dynamic import pulls the test helper into the bundle just the same",
      filename: REPO_LAYER,
      code: `export const lazySeed = async () => (await import("@/test/factories")).makeInvoice;`,
      errors: [{ messageId: "testImport" }],
    },
    {
      name: "a re-export carries the same dependency an import does",
      filename: REPO_LAYER,
      code: `export { makeInvoice } from "../service/charge.test";`,
      errors: [{ messageId: "testImport" }],
    },
    {
      name: "a star re-export names no binding to notice",
      filename: REPO_LAYER,
      code: `export * from "../__tests__/fixtures";`,
      errors: [{ messageId: "testImport" }],
    },
    {
      name: "the extensionless spelling, where a pattern assuming a trailing dot misses",
      filename: REPO_LAYER,
      code: `import { helper } from "./queries.test";`,
      errors: [{ messageId: "testImport" }],
    },
    {
      name: "a type-only import still binds production types to a test module's shape",
      filename: REPO_LAYER,
      code: `import type { SeededRow } from "@/test/seed";`,
      errors: [{ messageId: "testImport" }],
    },
  ],

  legal: [
    {
      // A violation, and not this tier's. The specifier names no path a linter
      // can read, and the only thing that once matched it was a literal `src/`
      // in the pattern — root knowledge this tier no longer holds, and which was
      // wrong for every tree whose root is spelled differently. The structural
      // tier resolves the specifier and boundary/import-policy reports it there.
      name: "a relative path into the shared test root is the structural tier's finding",
      filename: REPO_LAYER,
      code: `import { seedDb } from "../../../src/test/seed";`,
    },
    {
      name: "a test file may import whatever it likes — the rule governs production code",
      filename: "/repo/src/features/billing/service/charge.test.ts",
      code: `import { seedDb } from "@/test/seed";\nimport { fakeRow } from "../__tests__/fixtures";`,
    },
    {
      name: "a helper inside __tests__ may reach its neighbours",
      filename: "/repo/src/features/billing/__tests__/fixtures.ts",
      code: `import { seedDb } from "@/test/seed";`,
    },
    {
      // The file `charge.test.helpers.ts` is production code — the exemption
      // predicate reads the whole suffix, and `.test.helpers` is not `.test`. A
      // specifier matcher looking for `.test.` ANYWHERE called the same module a
      // test, so one module was inside the architecture contract and outside it
      // depending on which rule asked.
      name: "a module whose name contains the suffix without ending in it is production code",
      filename: SERVICE,
      code: `import { chargeFixture } from "./charge.test.helpers";`,
    },
    {
      name: "a module whose name merely ends in the word",
      filename: SERVICE,
      code: `import { latestRate } from "@/shared/rates/latest";`,
    },
    {
      name: "a module whose name merely contains the word",
      filename: SERVICE,
      code: `import { attestation } from "./attestation";\nimport { protestBanner } from "../ui/protest";`,
    },
    {
      name: "a directory that merely starts with the test segment is not the test root",
      filename: SERVICE,
      code: `import { quote } from "@/testimonials/quote";`,
    },
    {
      name: "an ordinary production import",
      filename: SERVICE,
      code: `import { formatMoney } from "@/shared/money";`,
    },
    {
      name: "a one-off script is not part of the shipped module graph",
      filename: "/repo/src/scripts/backfill.ts",
      code: `import { seedDb } from "@/test/seed";`,
    },
  ],
});
