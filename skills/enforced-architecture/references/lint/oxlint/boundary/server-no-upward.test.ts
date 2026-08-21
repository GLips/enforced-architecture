import assert from "node:assert/strict";
import { test } from "node:test";
import { RECOMMENDED_VOCABULARY, type TreeVocabulary } from "../../policy/layout.ts";
import { describeRule } from "../lib/rule-spec.ts";
import { infraImportsUpperLayerMessageData, serverNoUpwardRule } from "./server-no-upward.ts";

// The RuleTester case below pins the WORDING; this pins that the wording is
// READ FROM THE TREE, and neither is the other. Every fixture in this file runs
// against the single entry in `DECLARED_TREES`, whose names `RECOMMENDED_VOCABULARY`
// spells — so a message frozen back to the literal `features, domains, or routes`
// renders text the case below still accepts. Measured: deleting the derivation and
// hard-coding the rendered string leaves this whole spec green. A second vocabulary
// is the only thing that separates the two, and a rule spec cannot declare a second
// tree.
//
// All four names are renamed at once, so no assertion here passes on an accident
// of the recommended spelling.
test("boundary/server-no-upward names the reporting tree's own upper directories", () => {
  const RENAMED: TreeVocabulary = {
    ...RECOMMENDED_VOCABULARY,
    aliasPrefix: "~/",
    infrastructureDir: "adapters",
    featuresDir: "capabilities",
    domainsDir: "core",
    routesDir: "pages",
  };
  assert.deepEqual(infraImportsUpperLayerMessageData(RENAMED), {
    infrastructureDir: "adapters",
    upperAreas: "~/capabilities, ~/core, ~/pages",
  });
});

const MAILER = "/repo/src/infrastructure/mailer/send.ts";
const TELEMETRY = "/repo/src/infrastructure/telemetry/track.ts";

describeRule("boundary/server-no-upward", serverNoUpwardRule, {
  obvious: [
    {
      // The message, asserted whole rather than by `messageId`, because a
      // message that stopped interpolating would report on exactly these
      // fixtures and read identically at the `messageId` level. The absent half
      // is the bare English list this rule shipped with — "features, domains, or
      // routes" — which named three directories the fence was deliberately NOT
      // keyed on. What this case cannot say is that the text is DERIVED: see the
      // derivation test at the top of the file, which is the half that goes red
      // on a freeze.
      name: "infrastructure consuming the feature layer it is meant to serve, and the message names the tree's own upper directories",
      filename: MAILER,
      code: `import { renderInvoice } from "@/features/billing";\nexport const send = () => renderInvoice();`,
      errors: [
        {
          message:
            "A module in infrastructure/ cannot import from @/features, @/domains, @/routes. The infrastructure/ layer provides services to the layers above it — it does not consume them. If this module needs feature-specific behavior, accept it as a parameter.",
        },
      ],
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
