import { describeRule } from "../lib/rule-spec.ts";
import { sharedUiPurityRule } from "./shared-ui-purity.ts";

const SHARED_UI = "/repo/src/shared/ui/badge.tsx";
const IMPORT_FEATURE = `import { invoiceTotal } from "@/features/billing";`;

describeRule("boundary/shared-ui-purity", sharedUiPurityRule, {
  obvious: [
    {
      name: "a shared UI primitive taking on a feature dependency",
      filename: SHARED_UI,
      code: IMPORT_FEATURE,
      errors: [{ messageId: "appImportInSharedUi" }],
    },
    {
      name: "a shared UI primitive taking on domain logic",
      filename: "/repo/src/shared/ui/price-tag.tsx",
      code: `import { taxRate } from "@/domains/pricing";`,
      errors: [{ messageId: "appImportInSharedUi" }],
    },
  ],

  adversarial: [
    {
      name: "a dynamic import is a call expression, not an import declaration",
      filename: SHARED_UI,
      code: `export const lazyDb = async () => (await import("@/infrastructure/db")).db;`,
      errors: [{ messageId: "appImportInSharedUi" }],
    },
    {
      name: "a re-export carries the same runtime dependency an import does",
      filename: SHARED_UI,
      code: `export { Route } from "@/routes/dashboard";`,
      errors: [{ messageId: "appImportInSharedUi" }],
    },
    {
      name: "a star re-export names no binding to notice",
      filename: SHARED_UI,
      code: `export * from "@/domains/pricing";`,
      errors: [{ messageId: "appImportInSharedUi" }],
    },
    {
      name: "a type-only import still couples the primitive to a feature's shape",
      filename: SHARED_UI,
      code: `import type { Invoice } from "@/features/billing";`,
      errors: [{ messageId: "appImportInSharedUi" }],
    },
    {
      name: "the bare layer barrel, with no path segment after it to match on",
      filename: SHARED_UI,
      code: `import infra from "@/infrastructure";`,
      errors: [{ messageId: "appImportInSharedUi" }],
    },
    {
      name: "a shared UI component nested in a subdirectory is still shared UI",
      filename: "/repo/src/shared/ui/table/cell.tsx",
      code: IMPORT_FEATURE,
      errors: [{ messageId: "appImportInSharedUi" }],
    },
  ],

  legal: [
    {
      name: "shared/, the one @/ path shared UI is allowed",
      filename: SHARED_UI,
      code: `import { formatDate } from "@/shared/date";\nimport { tokens } from "@/shared/ui/tokens";`,
    },
    {
      name: "a sibling primitive by relative path",
      filename: SHARED_UI,
      code: `import { cn } from "./cn";`,
    },
    {
      name: "client-safe env, which this template allows shared UI to read",
      filename: SHARED_UI,
      code: `import { env } from "@/env.client";`,
    },
    {
      name: "a top-level directory sharing a full prefix with a banned segment",
      filename: SHARED_UI,
      code: `import { registry } from "@/featuresets/registry";\nimport { legacyCart } from "@/features-legacy/cart";`,
    },
    {
      name: "a top-level directory sharing a partial prefix with a banned segment",
      filename: SHARED_UI,
      code: `import { flags } from "@/feature-flags";\nimport { routeTable } from "@/routing";`,
    },
    {
      name: "an external package",
      filename: SHARED_UI,
      code: `import { useState } from "react";`,
    },
    {
      name: "a directory that merely starts with 'ui' is not the shared UI layer",
      filename: "/repo/src/shared/ui-kit/button.tsx",
      code: IMPORT_FEATURE,
    },
    {
      name: "feature UI, which is where a component that needs feature data belongs",
      filename: "/repo/src/features/billing/ui/panel.tsx",
      code: IMPORT_FEATURE,
    },
    {
      name: "a shared UI test may reach across every boundary",
      filename: "/repo/src/shared/ui/badge.test.tsx",
      code: IMPORT_FEATURE,
    },
  ],
});
