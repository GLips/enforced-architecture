import { describeRule } from "../lib/rule-spec.ts";
import { noServiceOptionRule } from "./no-service-option.ts";

const SERVICE = "/repo/src/features/billing/service/charge-invoice.ts";
const IMPORTS = `import { Effect, Option } from "effect";\nimport { Metrics } from "@/features/billing/service/metrics";`;

describeRule("effect/no-service-option", noServiceOptionRule, {
  obvious: [
    {
      name: "the optional lookup inside a generator",
      filename: SERVICE,
      code: `${IMPORTS}\nexport const charge = Effect.gen(function* () {\n  const metrics = yield* Effect.serviceOption(Metrics);\n  return Option.isSome(metrics) ? metrics.value.count() : 0;\n});`,
      errors: [{ messageId: "optionalService" }],
    },
    {
      name: "the same lookup composed into a pipeline",
      filename: SERVICE,
      code: `${IMPORTS}\nexport const metricsOrNone = Effect.serviceOption(Metrics).pipe(\n  Effect.map(Option.getOrNull),\n);`,
      errors: [{ messageId: "optionalService" }],
    },
  ],

  adversarial: [
    {
      name: "computed member access spells the name without an identifier",
      filename: SERVICE,
      code: `${IMPORTS}\nexport const metricsOrNone = Effect["serviceOption"](Metrics);`,
      errors: [{ messageId: "optionalService" }],
    },
    {
      name: "reached through a namespace alias rather than the conventional Effect",
      filename: SERVICE,
      code: `import * as Eff from "effect/Effect";\nimport { Metrics } from "@/features/billing/service/metrics";\nexport const metricsOrNone = Eff.serviceOption(Metrics);`,
      errors: [{ messageId: "optionalService" }],
    },
    {
      name: "imported bare, with no member expression to match",
      filename: SERVICE,
      code: `import { serviceOption } from "effect/Effect";\nimport { Metrics } from "@/features/billing/service/metrics";\nexport const metricsOrNone = serviceOption(Metrics);`,
      errors: [{ messageId: "optionalService" }],
    },
    {
      name: "referenced as a value and applied elsewhere",
      filename: SERVICE,
      code: `${IMPORTS}\nconst lookup = Effect.serviceOption;\nexport const metricsOrNone = lookup(Metrics);`,
      errors: [{ messageId: "optionalService" }],
    },
    {
      name: "two optional services in one file are two wiring holes",
      filename: SERVICE,
      code: `${IMPORTS}\nimport { Tracer } from "@/features/billing/service/tracer";\nexport const metricsOrNone = Effect.serviceOption(Metrics);\nexport const tracerOrNone = Effect.serviceOption(Tracer);`,
      errors: [{ messageId: "optionalService" }, { messageId: "optionalService" }],
    },
  ],

  legal: [
    {
      name: "yielding the service, which keeps it a requirement of the effect",
      filename: SERVICE,
      code: `${IMPORTS}\nexport const charge = Effect.gen(function* () {\n  const metrics = yield* Metrics;\n  return metrics.count();\n});`,
    },
    {
      // The neighbour the exact-name match exists to protect: `serviceOptional` fails with
      // NoSuchElementException, so an absent service is still an error rather than a quiet branch.
      name: "the neighbouring accessor that keeps absence an error",
      filename: SERVICE,
      code: `${IMPORTS}\nexport const metricsOrFail = Effect.serviceOptional(Metrics);`,
    },
    {
      name: "an Option in the domain has nothing to do with service wiring",
      filename: SERVICE,
      code: `${IMPORTS}\nexport const firstDiscount = (codes: ReadonlyArray<string>) =>\n  codes.length === 0 ? Option.none() : Option.some(codes[0]);`,
    },
    {
      name: "the no-op layer the rule pushes toward, where the choice is made in composition",
      filename: SERVICE,
      code: `import { Layer } from "effect";\nimport { Metrics } from "@/features/billing/service/metrics";\nexport const MetricsNoop = Layer.succeed(Metrics, { count: () => 0 });`,
    },
    {
      name: "a similarly named config key is not the accessor",
      filename: SERVICE,
      code: `${IMPORTS}\nexport const defaults = { serviceOptions: { retries: 3 } };`,
    },
    {
      name: "a test may reach for the optional lookup while wiring a harness",
      filename: "/repo/src/features/billing/service/charge-invoice.test.ts",
      code: `${IMPORTS}\nconst metricsOrNone = Effect.serviceOption(Metrics);`,
    },
    {
      name: "a one-off script is not the shipped module graph",
      filename: "/repo/scripts/replay-charges.ts",
      code: `${IMPORTS}\nconst metricsOrNone = Effect.serviceOption(Metrics);`,
    },
  ],
});
