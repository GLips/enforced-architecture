import { describeRule } from "../lib/rule-spec.ts";
import { barrelDirectionRule } from "./barrel-direction.ts";

const FEATURE_BARREL = "/repo/src/features/billing/index.ts";
const DOMAIN_BARREL = "/repo/src/domains/pricing/index.ts";

describeRule("api/barrel-direction", barrelDirectionRule, {
  obvious: [
    {
      name: "a client barrel re-exporting its server barrel wholesale",
      filename: FEATURE_BARREL,
      code: `export * from "./index.server";`,
      errors: [
        {
          message:
            "Barrel index must not import from index.server — this pulls server-only code into client bundles. If the export is client-safe (types, createServerFn references), re-export it from controllers/ instead. If it is server-only, it belongs in index.server only.",
        },
      ],
    },
    {
      name: "the rule governs the domains layer too, not only features",
      filename: DOMAIN_BARREL,
      code: `export { priceTable } from "./index.server";`,
      errors: [{ messageId: "clientBarrelImportsServerBarrel" }],
    },
  ],

  adversarial: [
    {
      name: "a plain import is not a re-export at all",
      filename: FEATURE_BARREL,
      code: `import { auditLog } from "./index.server";\nexport const audited = auditLog;`,
      errors: [{ messageId: "clientBarrelImportsServerBarrel" }],
    },
    {
      name: "a dynamic import is a call expression, not a module declaration",
      filename: FEATURE_BARREL,
      code: `export const lazyCharge = async () => (await import("./index.server")).chargeCard;`,
      errors: [{ messageId: "clientBarrelImportsServerBarrel" }],
    },
    {
      name: "the barrel reaching its own server sibling through the path alias, not a relative path",
      filename: FEATURE_BARREL,
      code: `export { chargeCard } from "@/features/billing/index.server";`,
      errors: [{ messageId: "clientBarrelImportsServerBarrel" }],
    },
    {
      name: "another feature's server barrel leaks into client bundles just the same",
      filename: FEATURE_BARREL,
      code: `export { auditLog } from "../audit/index.server";`,
      errors: [{ messageId: "clientBarrelImportsServerBarrel" }],
    },
    {
      name: "an explicit file extension on the specifier",
      filename: FEATURE_BARREL,
      code: `export { chargeCard } from "./index.server.ts";`,
      errors: [{ messageId: "clientBarrelImportsServerBarrel" }],
    },
    {
      name: "a barrel spelled index.tsx is still the barrel",
      filename: "/repo/src/features/billing/index.tsx",
      code: `import type { Charge } from "./index.server";\nexport type Alias = Charge;`,
      errors: [{ messageId: "clientBarrelImportsServerBarrel" }],
    },
  ],

  legal: [
    {
      name: "the server barrel may re-export the client barrel — the superset direction",
      filename: "/repo/src/features/billing/index.server.ts",
      code: `export * from "./index";\nexport { chargeCard } from "./repo/charge";`,
    },
    {
      name: "a client barrel re-exporting its own client-safe internals is the whole point",
      filename: FEATURE_BARREL,
      code: `export { startCheckout } from "./controllers/start";\nexport * from "./ui/panel";`,
    },
    {
      name: "a neighbour whose name merely starts with the barrel's",
      filename: FEATURE_BARREL,
      code: `export { CHECKOUT_TIMEOUT_MS } from "./index.server-config";`,
    },
    {
      name: "a non-barrel module inside the feature is governed by server-import-context, not this rule",
      filename: "/repo/src/features/billing/controllers/charge.ts",
      code: `import { chargeCard } from "../index.server";\nexport const charge = () => chargeCard();`,
    },
    {
      name: "a nested ui/index.ts is not the feature's public barrel",
      filename: "/repo/src/features/billing/ui/index.ts",
      code: `export { auditLog } from "../index.server";`,
    },
    {
      name: "a directory that merely starts with 'features' holds no governed barrel",
      filename: "/repo/src/features-legacy/billing/index.ts",
      code: `export * from "./index.server";`,
    },
    {
      name: "a shared barrel is outside the two layers this template governs",
      filename: "/repo/src/shared/index.ts",
      code: `export * from "./index.server";`,
    },
  ],
});
