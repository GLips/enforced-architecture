import { describeRule } from "../lib/rule-spec.ts";
import { featurePublicApiRule } from "./feature-public-api.ts";

const ROUTE = "/repo/src/routes/dashboard.tsx";
const OTHER_FEATURE = "/repo/src/features/checkout/service/finalise.ts";
const SHARED = "/repo/src/shared/format.ts";
const INFRASTRUCTURE = "/repo/src/infrastructure/mailer/send.ts";

describeRule("api/feature-public-api", featurePublicApiRule, {
  obvious: [
    {
      name: "a route reaching past the feature barrel into its repo layer",
      filename: ROUTE,
      code: `import { listInvoices } from "@/features/billing/repo/queries";`,
      errors: [{ messageId: "fromRoute" }],
    },
    {
      name: "one feature reaching into another feature's service layer",
      filename: OTHER_FEATURE,
      code: `import { chargeCard } from "@/features/billing/service/charge";`,
      errors: [{ messageId: "crossFeature" }],
    },
    {
      name: "shared reaching into a feature's UI, which routes may do and shared may not",
      filename: SHARED,
      code: `import { InvoiceRow } from "@/features/billing/ui/row";`,
      errors: [{ messageId: "fromLowerLayer" }],
    },
  ],

  adversarial: [
    {
      name: "routes are isomorphic, so even the server barrel is off limits there",
      filename: ROUTE,
      code: `import { deleteInvoice } from "@/features/billing/index.server";`,
      errors: [{ messageId: "fromRoute" }],
    },
    {
      name: "a sibling directory that merely starts with 'ui' is not the ui directory",
      filename: ROUTE,
      code: `import { Card } from "@/features/billing/uikit/card";`,
      errors: [{ messageId: "fromRoute" }],
    },
    {
      name: "a dynamic cross-feature deep import is a call expression, not an import declaration",
      filename: OTHER_FEATURE,
      code: `export const lazyRefund = async () => (await import("@/features/billing/service/refund")).refund;`,
      errors: [{ messageId: "crossFeature" }],
    },
    {
      name: "a type-only cross-feature deep import still couples to the internal layout",
      filename: OTHER_FEATURE,
      code: `import type { Invoice } from "@/features/billing/repo/totals";\nexport const rows: Invoice[] = [];`,
      errors: [{ messageId: "crossFeature" }],
    },
    {
      name: "a feature whose name merely starts with the caller's is still another feature",
      filename: "/repo/src/features/billing-admin/service/audit.ts",
      code: `import { chargeCard } from "@/features/billing/service/charge";`,
      errors: [{ messageId: "crossFeature" }],
    },
    {
      name: "a star re-export from infrastructure inverts the layer direction with no binding to notice",
      filename: INFRASTRUCTURE,
      code: `export * from "@/features/billing/service/render";`,
      errors: [{ messageId: "fromLowerLayer" }],
    },
    {
      name: "lower layers get no server seam either, unlike a sibling feature",
      filename: SHARED,
      code: `import { chargeCard } from "@/features/billing/index.server";`,
      errors: [{ messageId: "fromLowerLayer" }],
    },
  ],

  legal: [
    {
      name: "the feature barrel, which is legal from anywhere",
      filename: SHARED,
      code: `import { billingLabel } from "@/features/billing";`,
    },
    {
      name: "feature UI is the one deep path routes may use",
      filename: ROUTE,
      code: `import { InvoiceRow } from "@/features/billing/ui/row";`,
    },
    {
      name: "the ui directory's own barrel, with no segment past it",
      filename: ROUTE,
      code: `import { InvoiceTable } from "@/features/billing/ui";`,
    },
    {
      name: "cross-feature through the server barrel, the seam features share",
      filename: "/repo/src/features/checkout/controllers/start.ts",
      code: `import { chargeCard } from "@/features/billing/index.server";`,
    },
    {
      name: "a feature reaching its own internals through the alias is still inside the feature",
      filename: "/repo/src/features/billing/ui/row.tsx",
      code: `import { invoiceTotal } from "@/features/billing/repo/totals";`,
    },
    {
      name: "a top-level directory whose name merely starts with 'features'",
      filename: ROUTE,
      code: `import { legacyRow } from "@/features-legacy/billing/repo/queries";`,
    },
    {
      name: "a test may reach across every boundary",
      filename: "/repo/src/features/checkout/service/finalise.test.ts",
      code: `import { chargeCard } from "@/features/billing/service/charge";`,
    },
    {
      name: "a one-off script is not part of the shipped module graph",
      filename: "/repo/scripts/seed-invoices.ts",
      code: `import { listInvoices } from "@/features/billing/repo/queries";`,
    },
  ],
});
