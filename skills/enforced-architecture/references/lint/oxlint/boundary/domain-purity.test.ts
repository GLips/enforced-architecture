import { describeRule } from "../lib/rule-spec.ts";
import { domainPurityRule } from "./domain-purity.ts";

const DOMAIN = "/repo/src/domains/pricing.ts";

describeRule("boundary/domain-purity", domainPurityRule, {
  obvious: [
    {
      name: "a domain reaching for a provider SDK",
      filename: DOMAIN,
      code: `import Stripe from "stripe";\nexport const client = (key: string) => new Stripe(key);`,
      errors: [{ messageId: "impureDomainImport" }],
    },
    {
      name: "a domain reaching for a node builtin",
      filename: DOMAIN,
      code: `import { readFile } from "node:fs";`,
      errors: [{ messageId: "impureDomainImport" }],
    },
    {
      name: "a domain reaching sideways into a feature",
      filename: DOMAIN,
      code: `import { chargeInvoice } from "@/features/billing";`,
      errors: [{ messageId: "impureDomainImport" }],
    },
  ],

  adversarial: [
    {
      name: "a star re-export is a runtime dependency with no binding to notice",
      filename: DOMAIN,
      code: `export * from "expo-sqlite";`,
      errors: [{ messageId: "impureDomainImport" }],
    },
    {
      name: "a named re-export carries the same runtime dependency an import does",
      filename: DOMAIN,
      code: `export { Stripe } from "stripe";`,
      errors: [{ messageId: "impureDomainImport" }],
    },
    {
      name: "a dynamic import is a call expression, not an import declaration",
      filename: DOMAIN,
      code: `export const load = async () => await import("@sentry/node");`,
      errors: [{ messageId: "impureDomainImport" }],
    },
    {
      name: "an inline type specifier alongside a value one still binds the value at runtime",
      filename: DOMAIN,
      code: `import { type Stats, readFile } from "node:fs";`,
      errors: [{ messageId: "impureDomainImport" }],
    },
    {
      name: "a side-effect-only import has no specifiers, so 'every specifier is a type' must not vacuously pass",
      filename: DOMAIN,
      code: `import "reflect-metadata";`,
      errors: [{ messageId: "impureDomainImport" }],
    },
    {
      name: "an alias that merely starts with a permitted segment is a different layer",
      filename: DOMAIN,
      code: `import { tierFor } from "@/domains-legacy/billing";\nimport { clamp } from "@/sharedlib/math";`,
      errors: [{ messageId: "impureDomainImport" }, { messageId: "impureDomainImport" }],
    },
    {
      name: "a package subpath, where a pattern written against the bare package name misses",
      filename: DOMAIN,
      code: `import { deepThing } from "posthog-node/lib/deep";`,
      errors: [{ messageId: "impureDomainImport" }],
    },
  ],

  legal: [
    {
      name: "a type import pulls in no runtime value: the shape of a thing is not the thing",
      filename: DOMAIN,
      code: `import type { LanguageModel } from "ai";`,
    },
    {
      name: "a type-only re-export is erased too",
      filename: DOMAIN,
      code: `export type { Stats } from "node:fs";`,
    },
    {
      name: "an import whose every specifier is inline-type is erased as surely as import type",
      filename: DOMAIN,
      code: `import { type Stats } from "node:fs";`,
    },
    {
      name: "relative imports stay inside the domain layer",
      filename: DOMAIN,
      code: `import { normalise } from "./normalise";\nimport { scoreRisk } from "../risk/score";`,
    },
    {
      name: "a sibling domain by alias is the one cross-layer import a domain may make",
      filename: DOMAIN,
      code: `import { tierFor } from "@/domains/billing";\nimport { clamp } from "@/shared/math";`,
    },
    {
      name: "the bare permitted barrels, with no path segment after them",
      filename: DOMAIN,
      code: `import { tierFor } from "@/domains";\nimport { clamp } from "@/shared";`,
    },
    {
      name: "a domain test may import whatever it needs to exercise the seam",
      filename: "/repo/src/domains/pricing.test.ts",
      code: `import Stripe from "stripe";`,
    },
    {
      name: "a directory that merely starts with the domain segment is not the domain layer",
      filename: "/repo/src/domains-legacy/pricing.ts",
      code: `import Stripe from "stripe";`,
    },
    {
      name: "layers above the domain buy SDKs for a living",
      filename: "/repo/src/features/billing/service/charge.ts",
      code: `import Stripe from "stripe";`,
    },
  ],
});
