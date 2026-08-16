import { describeRule } from "../lib/rule-spec.ts";
import { noSilentErrorSwallowRule } from "./no-silent-error-swallow.ts";

const SERVICE = "/repo/src/features/billing/service/charge-invoice.ts";
const IMPORTS = `import { Effect, pipe } from "effect";\nimport { chargeCard } from "@/features/billing/service/payments";`;

describeRule("effect/no-silent-error-swallow", noSilentErrorSwallowRule, {
  obvious: [
    {
      name: "catchAll returning the unit effect, data-last inside a pipe",
      filename: SERVICE,
      code: `${IMPORTS}\nexport const charge = (id: string) =>\n  chargeCard(id).pipe(Effect.catchAll(() => Effect.void));`,
      errors: [{ messageId: "silentErrorSwallow" }],
    },
    {
      name: "catchTag on one named error",
      filename: SERVICE,
      code: `${IMPORTS}\nexport const charge = (id: string) =>\n  chargeCard(id).pipe(Effect.catchTag("CardDeclined", () => Effect.void));`,
      errors: [{ messageId: "silentErrorSwallow" }],
    },
  ],

  adversarial: [
    {
      // The handler is argument two here and argument one in the piped form. A rule reading
      // `arguments[0]` reports on one spelling of the same swallow and stays silent on the other.
      name: "the data-first spelling, where the handler is not the first argument",
      filename: SERVICE,
      code: `${IMPORTS}\nexport const charge = (id: string) =>\n  Effect.catchAll(chargeCard(id), () => Effect.void);`,
      errors: [{ messageId: "silentErrorSwallow" }],
    },
    {
      name: "data-first catchTag, where the handler is the third argument",
      filename: SERVICE,
      code: `${IMPORTS}\nexport const charge = (id: string) =>\n  Effect.catchTag(chargeCard(id), "CardDeclined", () => Effect.void);`,
      errors: [{ messageId: "silentErrorSwallow" }],
    },
    {
      name: "the standalone pipe function rather than the method",
      filename: SERVICE,
      code: `${IMPORTS}\nexport const charge = (id: string) =>\n  pipe(chargeCard(id), Effect.catchAll(() => Effect.void));`,
      errors: [{ messageId: "silentErrorSwallow" }],
    },
    {
      name: "the catchTags object form, where the handler is a property value",
      filename: SERVICE,
      code: `${IMPORTS}\nexport const charge = (id: string) =>\n  chargeCard(id).pipe(\n    Effect.catchTags({\n      CardDeclined: () => Effect.void,\n      NetworkError: (error) => Effect.fail(error),\n    }),\n  );`,
      errors: [{ messageId: "silentErrorSwallow" }],
    },
    {
      name: "two swallowed tags in one catchTags are two findings",
      filename: SERVICE,
      code: `${IMPORTS}\nexport const charge = (id: string) =>\n  Effect.catchTags(chargeCard(id), {\n    CardDeclined: () => Effect.void,\n    NetworkError: () => Effect.void,\n  });`,
      errors: [{ messageId: "silentErrorSwallow" }, { messageId: "silentErrorSwallow" }],
    },
    {
      // A log line before the return is what the swallow looks like once someone has felt uneasy
      // about it. The handler still returns nothing, and the error is still gone from the type.
      name: "a block body that logs first and swallows anyway",
      filename: SERVICE,
      code: `${IMPORTS}\nexport const charge = (id: string) =>\n  chargeCard(id).pipe(\n    Effect.catchAll((error) => {\n      console.error(error);\n      return Effect.void;\n    }),\n  );`,
      errors: [{ messageId: "silentErrorSwallow" }],
    },
    {
      name: "the pre-3.x name for the same empty effect",
      filename: SERVICE,
      code: `${IMPORTS}\nexport const charge = (id: string) =>\n  chargeCard(id).pipe(Effect.catchAll(() => Effect.unit));`,
      errors: [{ messageId: "silentErrorSwallow" }],
    },
    {
      name: "the empty effect built by hand, around a ban on the short name",
      filename: SERVICE,
      code: `${IMPORTS}\nexport const charge = (id: string) =>\n  chargeCard(id).pipe(Effect.catchAll(() => Effect.succeed(undefined)));`,
      errors: [{ messageId: "silentErrorSwallow" }],
    },
    {
      name: "a function expression rather than an arrow",
      filename: SERVICE,
      code: `${IMPORTS}\nexport const charge = (id: string) =>\n  chargeCard(id).pipe(\n    Effect.catchAll(function recover() {\n      return Effect.void;\n    }),\n  );`,
      errors: [{ messageId: "silentErrorSwallow" }],
    },
    {
      name: "the combinator imported bare, with no Effect namespace to match on",
      filename: SERVICE,
      code: `import { catchAll } from "effect/Effect";\nimport * as Eff from "effect/Effect";\nimport { chargeCard } from "@/features/billing/service/payments";\nexport const charge = (id: string) => catchAll(chargeCard(id), () => Eff.void);`,
      errors: [{ messageId: "silentErrorSwallow" }],
    },
    {
      name: "computed member access spells the combinator without an identifier",
      filename: SERVICE,
      code: `${IMPORTS}\nexport const charge = (id: string) =>\n  Effect["catchAll"](chargeCard(id), () => Effect.void);`,
      errors: [{ messageId: "silentErrorSwallow" }],
    },
    {
      // The computed spelling on the OTHER side. `void` is a reserved word, so `Effect["void"]` is
      // the form a codebase reaches for by habit — and a rule that handles computed access on the
      // combinator but not on the empty effect is silent on exactly this line.
      name: "the empty effect itself written as computed access",
      filename: SERVICE,
      code: `${IMPORTS}\nexport const charge = (id: string) =>\n  chargeCard(id).pipe(Effect.catchAll(() => Effect["void"]));`,
      errors: [{ messageId: "silentErrorSwallow" }],
    },
  ],

  legal: [
    {
      name: "recovering with a value the caller can use",
      filename: SERVICE,
      code: `${IMPORTS}\nexport const charge = (id: string) =>\n  chargeCard(id).pipe(Effect.catchTag("CardDeclined", () => Effect.succeed({ charged: false })));`,
    },
    {
      name: "mapping the failure to an error this layer declares",
      filename: SERVICE,
      code: `${IMPORTS}\nimport { BillingUnavailable } from "@/features/billing/domain/errors";\nexport const charge = (id: string) =>\n  chargeCard(id).pipe(Effect.catchAll((cause) => Effect.fail(new BillingUnavailable({ cause }))));`,
    },
    {
      name: "a handler that does real recovery work in a generator",
      filename: SERVICE,
      code: `${IMPORTS}\nimport { retryLedger } from "@/features/billing/service/ledger";\nexport const charge = (id: string) =>\n  chargeCard(id).pipe(\n    Effect.catchTag("NetworkError", () =>\n      Effect.gen(function* () {\n        yield* retryLedger(id);\n        return { charged: true };\n      }),\n    ),\n  );`,
    },
    {
      // Not a catch: `tap` runs alongside the value and changes no failure channel, so the empty
      // effect there is a no-op, not a swallow. Reporting it would train people past the rule.
      name: "the empty effect in a combinator that is not catching anything",
      filename: SERVICE,
      code: `${IMPORTS}\nexport const charge = (id: string) => chargeCard(id).pipe(Effect.tap(() => Effect.void));`,
    },
    {
      // Negative space, asserted: a handler passed by reference is not followed to its
      // declaration, so the rule stays silent here by design rather than by accident.
      name: "a handler passed by reference is not followed",
      filename: SERVICE,
      code: `${IMPORTS}\nconst recover = () => Effect.void;\nexport const charge = (id: string) => chargeCard(id).pipe(Effect.catchAll(recover));`,
    },
    {
      name: "the empty effect as a normal branch of a program, nowhere near a catch",
      filename: SERVICE,
      code: `${IMPORTS}\nexport const notify = (shouldSend: boolean) =>\n  shouldSend ? chargeCard("inv_1") : Effect.void;`,
    },
    {
      name: "a test may assert that a swallowing handler behaves as written",
      filename: "/repo/src/features/billing/service/charge-invoice.test.ts",
      code: `${IMPORTS}\nconst quiet = chargeCard("inv_1").pipe(Effect.catchAll(() => Effect.void));`,
    },
    {
      name: "a one-off script is not the shipped module graph",
      filename: "/repo/scripts/replay-charges.ts",
      code: `${IMPORTS}\nconst quiet = chargeCard("inv_1").pipe(Effect.catchAll(() => Effect.void));`,
    },
  ],
});
