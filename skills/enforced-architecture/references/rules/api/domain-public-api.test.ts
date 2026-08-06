import { describeRule } from "../lib/rule-spec.ts";
import { domainPublicApiRule } from "./domain-public-api.ts";

const CONTROLLER = "/repo/src/features/billing/controllers/charge.ts";
const SERVICE = "/repo/src/features/billing/service/quote.ts";

describeRule("api/domain-public-api", domainPublicApiRule, {
  obvious: [
    {
      name: "a controller reaching past the domain barrel into a leaf module",
      filename: CONTROLLER,
      code: `import { calculateTax } from "@/domains/pricing/calculate";`,
      errors: [{ messageId: "deepDomainImport" }],
    },
    {
      name: "a UI component reaching into a domain's internals",
      filename: "/repo/src/features/billing/ui/quote.tsx",
      code: `import { roundToCents } from "@/domains/pricing/internal/rounding";`,
      errors: [{ messageId: "deepDomainImport" }],
    },
  ],

  adversarial: [
    {
      name: "a dynamic import is a call expression, not an import declaration",
      filename: SERVICE,
      code: `export const lazyRate = async () => (await import("@/domains/pricing/rates/live")).rate;`,
      errors: [{ messageId: "deepDomainImport" }],
    },
    {
      name: "a re-export carries the same coupling an import does",
      filename: SERVICE,
      code: `export { roundToCents } from "@/domains/pricing/internal/rounding";`,
      errors: [{ messageId: "deepDomainImport" }],
    },
    {
      name: "a star re-export names no binding to notice",
      filename: SERVICE,
      code: `export * from "@/domains/pricing/internal/currency";`,
      errors: [{ messageId: "deepDomainImport" }],
    },
    {
      name: "a type-only deep import still couples callers to the internal layout",
      filename: SERVICE,
      code: `import type { TaxBand } from "@/domains/pricing/tables/bands";\nexport const bands: TaxBand[] = [];`,
      errors: [{ messageId: "deepDomainImport" }],
    },
    {
      name: "a module whose name merely starts with the server barrel's is not the server barrel",
      filename: SERVICE,
      code: `import { TAX_TIMEOUT_MS } from "@/domains/pricing/index.server-config";`,
      errors: [{ messageId: "deepDomainImport" }],
    },
    {
      name: "an index.server nested below the domain root is not the domain's server barrel",
      filename: SERVICE,
      code: `import { vat } from "@/domains/pricing/tables/index.server";`,
      errors: [{ messageId: "deepDomainImport" }],
    },
  ],

  legal: [
    {
      name: "the domain barrel, which is exactly what callers are meant to use",
      filename: CONTROLLER,
      code: `import { calculateTax } from "@/domains/pricing";`,
    },
    {
      name: "the domain's server barrel, the one blessed deep path",
      filename: CONTROLLER,
      code: `import { priceTable } from "@/domains/pricing/index.server";`,
    },
    {
      name: "a domain owns its own file layout and may reach any internal, its own or a sibling's",
      filename: "/repo/src/domains/pricing/calculate.ts",
      code: `import { riskBand } from "@/domains/risk/internal/band";`,
    },
    {
      name: "a top-level directory whose name merely starts with 'domains'",
      filename: SERVICE,
      code: `import { legacyRate } from "@/domains-legacy/pricing/rate";`,
    },
    {
      name: "a deep import into a feature is a different rule's business",
      filename: SERVICE,
      code: `import { chargeCard } from "@/features/billing/service/charge";`,
    },
    {
      name: "a test may reach across every boundary",
      filename: "/repo/src/features/billing/service/quote.test.ts",
      code: `import { calculateTax } from "@/domains/pricing/calculate";`,
    },
    {
      name: "a one-off script is not part of the shipped module graph",
      filename: "/repo/scripts/backfill-rates.ts",
      code: `import { calculateTax } from "@/domains/pricing/calculate";`,
    },
  ],
});
