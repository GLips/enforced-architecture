import assert from "node:assert/strict";
import { test } from "node:test";
import { RECOMMENDED_VOCABULARY, type TreeVocabulary } from "../../policy/layout.ts";
import { describeRule } from "../lib/rule-spec.ts";
import { noTestImportsRule, testImportMessageData } from "./no-test-imports.ts";

// The RuleTester case below pins the WORDING; this pins that the wording is
// READ FROM THE TREE, and neither is the other. Every fixture in this file runs
// against the single entry in `DECLARED_TREES`, whose names `RECOMMENDED_VOCABULARY`
// spells — so a message frozen back to a literal `@/shared/` renders exactly the
// text asserted below and passes. Measured: deleting the derivation and hard-coding
// the rendered string leaves this whole spec green. A second vocabulary is the only
// thing that separates the two, and a rule spec cannot declare a second tree.
test("boundary/no-test-imports sends the reader to the reporting tree's own shared directory", () => {
  const RENAMED: TreeVocabulary = {
    ...RECOMMENDED_VOCABULARY,
    aliasPrefix: "~/",
    sharedDir: "common",
  };
  assert.deepEqual(testImportMessageData(RENAMED), { shared: "~/common" });
});

const SERVICE = "/repo/src/features/billing/service/charge.ts";
const REPO_LAYER = "/repo/src/features/billing/repo/queries.ts";

describeRule("boundary/no-test-imports", noTestImportsRule, {
  obvious: [
    {
      // The message, asserted whole rather than by `messageId`, because a
      // message that stopped interpolating would report on exactly these
      // fixtures and read identically at the `messageId` level. `src/shared/` is
      // the absent half — the frozen literal this rule shipped with, which named
      // a directory no tree rooted outside `src` has. What this case cannot say
      // is that the text is DERIVED: see the derivation test at the top of the
      // file, which is the half that goes red on a freeze.
      name: "production code importing a sibling spec, and the message names the tree's own shared directory",
      filename: SERVICE,
      code: `import { makeInvoice } from "./charge.test";\nexport const charge = () => makeInvoice();`,
      errors: [
        {
          message:
            "Production code cannot import from test files. If this utility is needed by both tests and production, move it to @/shared/ or the appropriate production directory.",
        },
      ],
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
