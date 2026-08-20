import { describeRule } from "../lib/rule-spec.ts";
import { serverNoUpwardRule } from "./server-no-upward.ts";

const MAILER = "/repo/src/infrastructure/mailer/send.ts";
const TELEMETRY = "/repo/src/infrastructure/telemetry/track.ts";

describeRule("boundary/server-no-upward", serverNoUpwardRule, {
  obvious: [
    {
      name: "infrastructure consuming the feature layer it is meant to serve",
      filename: MAILER,
      code: `import { renderInvoice } from "@/features/billing";\nexport const send = () => renderInvoice();`,
      errors: [{ messageId: "infraImportsUpperLayer" }],
    },
    {
      name: "infrastructure reaching into the domain layer",
      filename: TELEMETRY,
      code: `import { riskBand } from "@/domains/risk";`,
      errors: [{ messageId: "infraImportsUpperLayer" }],
    },
    {
      name: "infrastructure reaching into a route module",
      filename: TELEMETRY,
      code: `import { Route } from "@/routes/dashboard";`,
      errors: [{ messageId: "infraImportsUpperLayer" }],
    },
  ],

  adversarial: [
    {
      name: "a dynamic import reverses the dependency arrow just as surely",
      filename: TELEMETRY,
      code: `export const lazyRoute = async () => (await import("@/routes/dashboard")).Route;`,
      errors: [{ messageId: "infraImportsUpperLayer" }],
    },
    {
      name: "a re-export carries the same dependency an import does",
      filename: TELEMETRY,
      code: `export { InvoiceRow } from "@/features/billing/ui/row";`,
      errors: [{ messageId: "infraImportsUpperLayer" }],
    },
    {
      name: "a star re-export names no binding to notice",
      filename: TELEMETRY,
      code: `export * from "@/features/billing";`,
      errors: [{ messageId: "infraImportsUpperLayer" }],
    },
    {
      name: "a type-only import still couples infrastructure to a feature's internals",
      filename: MAILER,
      code: `import type { Invoice } from "@/features/billing";`,
      errors: [{ messageId: "infraImportsUpperLayer" }],
    },
    {
      name: "a nested infrastructure module is still infrastructure",
      filename: "/repo/src/infrastructure/payments/stripe/webhooks/handler.ts",
      code: `import { markPaid } from "@/features/billing";`,
      errors: [{ messageId: "infraImportsUpperLayer" }],
    },
  ],

  legal: [
    {
      // Upward, and reported — by boundary/import-policy, as `unclassifiedTarget`.
      // A subdivided directory names no unit, so this rule has no area to compare
      // against and stays quiet rather than guessing. The two messages are
      // jointly actionable: the fix is to name the feature, and this rule then
      // reports the edge that names it.
      name: "the bare subdivided directory is import-policy's finding, not this rule's",
      filename: TELEMETRY,
      code: `import features from "@/features";\nimport domains from "@/domains";`,
    },
    {
      name: "infrastructure reaching sideways to its own layer",
      filename: MAILER,
      code: `import { logger } from "@/infrastructure/telemetry/logger";\nimport { renderTemplate } from "./template";`,
    },
    {
      name: "infrastructure reaching down to shared utilities and validated config",
      filename: MAILER,
      code: `import { formatDate } from "@/shared/date";\nimport { env } from "@/env";`,
    },
    {
      name: "a top-level directory sharing a full prefix with a banned segment",
      filename: MAILER,
      code: `import { registry } from "@/featuresets/registry";\nimport { legacyCart } from "@/features-legacy/cart";`,
    },
    {
      name: "a top-level directory that diverges inside the banned segment",
      filename: MAILER,
      code: `import { featureFlags } from "@/feature-flags";\nimport { routeTable } from "@/routing";`,
    },
    {
      name: "a test may reach across every boundary",
      filename: "/repo/src/infrastructure/mailer/send.test.ts",
      code: `import { renderInvoice } from "@/features/billing";`,
    },
    {
      name: "a directory that merely starts with the infrastructure segment is not governed",
      filename: "/repo/src/infrastructure-legacy/mailer/send.ts",
      code: `import { renderInvoice } from "@/features/billing";`,
    },
    {
      name: "the feature layer importing itself is what the layering is for",
      filename: "/repo/src/features/billing/service/charge.ts",
      code: `import { riskBand } from "@/domains/risk";`,
    },
  ],
});
