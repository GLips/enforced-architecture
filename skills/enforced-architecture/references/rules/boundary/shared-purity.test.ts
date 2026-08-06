import { describeRule } from "../lib/rule-spec.ts";
import { sharedPurityRule } from "./shared-purity.ts";

const SHARED = "/repo/src/shared/date.ts";
const IMPORT_FEATURE = `import { billingLabel } from "@/features/billing";`;

describeRule("boundary/shared-purity", sharedPurityRule, {
  obvious: [
    {
      name: "a shared utility reaching up into a feature",
      filename: SHARED,
      code: IMPORT_FEATURE,
      errors: [{ messageId: "appImportInSharedUtility" }],
    },
    {
      name: "a shared utility reaching up into a domain",
      filename: "/repo/src/shared/money.ts",
      code: `import { taxRate } from "@/domains/pricing";`,
      errors: [{ messageId: "appImportInSharedUtility" }],
    },
  ],

  adversarial: [
    {
      name: "a dynamic import is a call expression, not an import declaration",
      filename: SHARED,
      code: `export const lazyEnv = async () => (await import("@/env")).env;`,
      errors: [{ messageId: "appImportInSharedUtility" }],
    },
    {
      name: "a re-export carries the same runtime dependency an import does",
      filename: SHARED,
      code: `export { db } from "@/infrastructure/db";`,
      errors: [{ messageId: "appImportInSharedUtility" }],
    },
    {
      name: "a star re-export names no binding to notice",
      filename: SHARED,
      code: `export * from "@/domains/pricing";`,
      errors: [{ messageId: "appImportInSharedUtility" }],
    },
    {
      name: "a type-only import still points the dependency graph upward",
      filename: SHARED,
      code: `import type { Money } from "@/domains/pricing";`,
      errors: [{ messageId: "appImportInSharedUtility" }],
    },
    {
      name: "a bare alias root, where the pattern assumed a directory after it",
      filename: SHARED,
      code: `import cfg from "@/config";`,
      errors: [{ messageId: "appImportInSharedUtility" }],
    },
    {
      name: "a top-level file whose name merely starts with 'ui' is not the shared/ui directory",
      filename: "/repo/src/shared/ui-helpers.ts",
      code: IMPORT_FEATURE,
      errors: [{ messageId: "appImportInSharedUtility" }],
    },
    {
      name: "a .tsx shared utility is governed the same as a .ts one",
      filename: "/repo/src/shared/portal.tsx",
      code: IMPORT_FEATURE,
      errors: [{ messageId: "appImportInSharedUtility" }],
    },
  ],

  legal: [
    {
      name: "relative imports within shared/, the whole budget at the bottom of the graph",
      filename: SHARED,
      code: `import { pad } from "./pad";\nimport { clamp } from "./number/clamp";`,
    },
    {
      name: "an external package",
      filename: SHARED,
      code: `import { format } from "date-fns";`,
    },
    {
      name: "a scoped package, which starts with @ but is not the alias",
      filename: SHARED,
      code: `import { captureException } from "@sentry/node";`,
    },
    {
      name: "shared/ui/, which has its own more permissive rule",
      filename: "/repo/src/shared/ui/badge.tsx",
      code: `import { formatDate } from "@/shared/date";`,
    },
    {
      name: "a nested shared module, which this template deliberately does not cover",
      filename: "/repo/src/shared/utils/format.ts",
      code: IMPORT_FEATURE,
    },
    {
      name: "a directory that merely starts with 'shared' is not the shared layer",
      filename: "/repo/src/shared-utils/date.ts",
      code: IMPORT_FEATURE,
    },
    {
      name: "a shared utility's test may reach across every boundary",
      filename: "/repo/src/shared/date.test.ts",
      code: IMPORT_FEATURE,
    },
    {
      name: "a feature module, which is above shared in the graph and may import freely",
      filename: "/repo/src/features/billing/service/charge.ts",
      code: `import { taxRate } from "@/domains/pricing";`,
    },
  ],
});
