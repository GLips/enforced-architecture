import { describeRule } from "../lib/rule-spec.ts";
import { noNestedLayerProvideRule } from "./no-nested-layer-provide.ts";

const WIRING = "/repo/src/features/billing/service/billing-layer.ts";
const IMPORTS = `import { Layer } from "effect";\nimport { AppLive, CacheLive, RepoLive, SqlLive } from "@/features/billing/service/layers";`;

describeRule("effect/no-nested-layer-provide", noNestedLayerProvideRule, {
  obvious: [
    {
      name: "a provide passed straight into another provide",
      filename: WIRING,
      code: `${IMPORTS}\nexport const BillingLive = Layer.provide(AppLive, Layer.provide(RepoLive, SqlLive));`,
      errors: [{ messageId: "nestedLayerProvide" }],
    },
    {
      name: "the same nest written across lines",
      filename: WIRING,
      code: `${IMPORTS}\nexport const BillingLive = Layer.provide(\n  AppLive,\n  Layer.provide(RepoLive, SqlLive),\n);`,
      errors: [{ messageId: "nestedLayerProvide" }],
    },
  ],

  adversarial: [
    {
      // The spelling Effect wiring is actually written in. A rule reading the outer call's direct
      // arguments sees a `.pipe(…)` call there and stops, so every real nest goes unreported.
      name: "nested through a pipe rather than as a direct argument",
      filename: WIRING,
      code: `${IMPORTS}\nexport const BillingLive = AppLive.pipe(Layer.provide(RepoLive.pipe(Layer.provide(SqlLive))));`,
      errors: [{ messageId: "nestedLayerProvide" }],
    },
    {
      // Both ends computed. A rule reading `callee.property.name` matches neither call, so the
      // whole nest is silent — and the outer spelling alone is enough to hide the inner one.
      name: "both provides written as computed member access",
      filename: WIRING,
      code: `${IMPORTS}\nexport const BillingLive = Layer["provide"](AppLive, Layer["provide"](RepoLive, SqlLive));`,
      errors: [{ messageId: "nestedLayerProvide" }],
    },
    {
      name: "nested one level deeper, inside a merge between the two provides",
      filename: WIRING,
      code: `${IMPORTS}\nexport const BillingLive = Layer.provide(\n  AppLive,\n  Layer.merge(CacheLive, Layer.provide(RepoLive, SqlLive)),\n);`,
      errors: [{ messageId: "nestedLayerProvide" }],
    },
    {
      name: "nested inside an array of layers",
      filename: WIRING,
      code: `${IMPORTS}\nexport const BillingLive = Layer.provide(AppLive, [CacheLive, Layer.provide(RepoLive, SqlLive)]);`,
      errors: [{ messageId: "nestedLayerProvide" }],
    },
    {
      name: "three levels deep are two nested provides, not one",
      filename: WIRING,
      code: `${IMPORTS}\nexport const BillingLive = Layer.provide(\n  AppLive,\n  Layer.provide(RepoLive, Layer.provide(CacheLive, SqlLive)),\n);`,
      errors: [{ messageId: "nestedLayerProvide" }, { messageId: "nestedLayerProvide" }],
    },
    {
      name: "nested inside a function that builds the layer, where no top-level statement shows it",
      filename: WIRING,
      code: `${IMPORTS}\nexport const makeBillingLive = (tenant: string) =>\n  Layer.provide(AppLive, Layer.provide(RepoLive(tenant), SqlLive));`,
      errors: [{ messageId: "nestedLayerProvide" }],
    },
  ],

  legal: [
    {
      // The fix the message asks for: the inner layer gets a name, and each edge is one line.
      name: "the inner layer bound to a name and passed by that name",
      filename: WIRING,
      code: `${IMPORTS}\nconst DataLive = Layer.provide(RepoLive, SqlLive);\nexport const BillingLive = Layer.provide(AppLive, DataLive);`,
    },
    {
      name: "sequential provides on one pipeline are flat, not nested",
      filename: WIRING,
      code: `${IMPORTS}\nexport const BillingLive = AppLive.pipe(Layer.provide(RepoLive), Layer.provide(SqlLive));`,
    },
    {
      name: "two independent layers wired in the same file",
      filename: WIRING,
      code: `${IMPORTS}\nexport const BillingLive = Layer.provide(AppLive, RepoLive);\nexport const CacheLayer = Layer.provide(CacheLive, SqlLive);`,
    },
    {
      name: "a provide method on something that is not the Layer module",
      filename: WIRING,
      code: `import { container } from "@/infrastructure/container";\nexport const wired = container.provide("billing", container.provide("sql", {}));`,
    },
    {
      name: "a merge tree with no provide in it at all",
      filename: WIRING,
      code: `${IMPORTS}\nexport const BillingLive = Layer.mergeAll(AppLive, RepoLive, SqlLive, CacheLive);`,
    },
    {
      name: "a test may wire a throwaway stack inline",
      filename: "/repo/src/features/billing/service/billing-layer.test.ts",
      code: `${IMPORTS}\nconst TestLive = Layer.provide(AppLive, Layer.provide(RepoLive, SqlLive));`,
    },
    {
      name: "a one-off script is not the shipped module graph",
      filename: "/repo/scripts/seed-billing.ts",
      code: `${IMPORTS}\nconst SeedLive = Layer.provide(AppLive, Layer.provide(RepoLive, SqlLive));`,
    },
  ],
});
