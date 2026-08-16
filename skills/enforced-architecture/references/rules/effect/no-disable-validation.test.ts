import { describeRule } from "../lib/rule-spec.ts";
import { noDisableValidationRule } from "./no-disable-validation.ts";

const REPOSITORY = "/repo/src/features/billing/service/invoice-repository.ts";
const IMPORTS = `import { Schema } from "effect";\nimport { Invoice, InvoiceRecord } from "@/features/billing/domain/invoice";`;

describeRule("effect/no-disable-validation", noDisableValidationRule, {
  obvious: [
    {
      name: "the opt-out on a default constructor",
      filename: REPOSITORY,
      code: `${IMPORTS}\nexport const draft = (fields: typeof Invoice.Encoded) =>\n  Invoice.make(fields, { disableValidation: true });`,
      errors: [{ messageId: "validationDisabled" }],
    },
    {
      name: "the opt-out on a Schema.Class constructor",
      filename: REPOSITORY,
      code: `${IMPORTS}\nexport const draft = (fields: { id: string; total: number }) =>\n  new InvoiceRecord(fields, { disableValidation: true });`,
      errors: [{ messageId: "validationDisabled" }],
    },
  ],

  adversarial: [
    {
      name: "the quoted key, which an identifier-only match misses",
      filename: REPOSITORY,
      code: `${IMPORTS}\nexport const draft = (fields: typeof Invoice.Encoded) =>\n  Invoice.make(fields, { "disableValidation": true });`,
      errors: [{ messageId: "validationDisabled" }],
    },
    {
      name: "the computed key, which is neither an identifier nor a plain literal key",
      filename: REPOSITORY,
      code: `${IMPORTS}\nexport const draft = (fields: typeof Invoice.Encoded) =>\n  Invoice.make(fields, { ["disableValidation"]: true });`,
      errors: [{ messageId: "validationDisabled" }],
    },
    {
      // The retry once literal `true` is refused: the value moves one line up and the option is
      // spelled shorthand. Validation is off exactly as before.
      name: "shorthand, where the value is a binding rather than the literal",
      filename: REPOSITORY,
      code: `${IMPORTS}\nconst disableValidation = true;\nexport const draft = (fields: typeof Invoice.Encoded) =>\n  Invoice.make(fields, { disableValidation });`,
      errors: [{ messageId: "validationDisabledConditionally" }],
    },
    {
      name: "the flag forwarded from a caller, so no path in the file reads as true",
      filename: REPOSITORY,
      code: `${IMPORTS}\nexport const draft = (fields: typeof Invoice.Encoded, options: { fast: boolean }) =>\n  Invoice.make(fields, { disableValidation: options.fast });`,
      errors: [{ messageId: "validationDisabledConditionally" }],
    },
    {
      name: "decided by a ternary on the environment",
      filename: REPOSITORY,
      code: `${IMPORTS}\nexport const draft = (fields: typeof Invoice.Encoded, isSeed: boolean) =>\n  Invoice.make(fields, { disableValidation: isSeed ? true : false });`,
      errors: [{ messageId: "validationDisabledConditionally" }],
    },
    {
      name: "the constructor reached through the schema module rather than a bound name",
      filename: REPOSITORY,
      code: `${IMPORTS}\nexport const draft = (fields: typeof Invoice.Encoded) =>\n  Schema.Struct({ id: Schema.String }).make(fields, { disableValidation: true });`,
      errors: [{ messageId: "validationDisabled" }],
    },
    {
      name: "computed access to the constructor, where the callee has no identifier to match",
      filename: REPOSITORY,
      code: `${IMPORTS}\nexport const draft = (fields: typeof Invoice.Encoded) =>\n  Invoice["make"](fields, { disableValidation: true });`,
      errors: [{ messageId: "validationDisabled" }],
    },
    {
      name: "spread across lines, where no single line carries both the call and the option",
      filename: REPOSITORY,
      code: `${IMPORTS}\nexport const draft = (fields: typeof Invoice.Encoded) =>\n  Invoice.make(fields, {\n    disableValidation: true,\n  });`,
      errors: [{ messageId: "validationDisabled" }],
    },
    {
      name: "two constructions in one file are two opt-outs, not one",
      filename: REPOSITORY,
      code: `${IMPORTS}\nexport const draft = (fields: typeof Invoice.Encoded) =>\n  Invoice.make(fields, { disableValidation: true });\nexport const record = (fields: { id: string; total: number }) =>\n  new InvoiceRecord(fields, { disableValidation: true });`,
      errors: [{ messageId: "validationDisabled" }, { messageId: "validationDisabled" }],
    },
  ],

  legal: [
    {
      name: "the constructor with no options at all, which is the whole point of the schema",
      filename: REPOSITORY,
      code: `${IMPORTS}\nexport const draft = (fields: typeof Invoice.Encoded) => Invoice.make(fields);`,
    },
    {
      name: "the option written explicitly false keeps validation on and says so",
      filename: REPOSITORY,
      code: `${IMPORTS}\nexport const draft = (fields: typeof Invoice.Encoded) =>\n  Invoice.make(fields, { disableValidation: false });`,
    },
    {
      // The scoping case. Before the rule anchored on the construction call, this collected a
      // diagnostic about schemas — for an option belonging to a cache library, on a line where no
      // schema appears at all.
      name: "an identically named option on an unrelated API",
      filename: REPOSITORY,
      code: `import { createCache } from "@/infrastructure/cache";\nexport const invoiceCache = createCache({ ttlMs: 60_000, disableValidation: true });`,
    },
    {
      name: "the same name as a bare configuration object bound to a const",
      filename: REPOSITORY,
      code: `export const cacheOptions = { disableValidation: true, ttlMs: 60_000 };`,
    },
    {
      // Negative space, asserted: with no scope resolution, an object assembled in one statement
      // and passed in another is not followed. Stated in the header rather than left to be
      // discovered as a surprise.
      name: "an options object built in a separate statement is not followed to the call",
      filename: REPOSITORY,
      code: `${IMPORTS}\nconst options = { disableValidation: true };\nexport const draft = (fields: typeof Invoice.Encoded) => Invoice.make(fields, options);`,
    },
    {
      name: "destructuring the option name is a read, not a decision",
      filename: REPOSITORY,
      code: `${IMPORTS}\nexport const describeOptions = (options: { disableValidation: boolean }) => {\n  const { disableValidation } = options;\n  return disableValidation ? "unchecked" : "checked";\n};`,
    },
    {
      name: "a longer key that merely starts with the same word",
      filename: REPOSITORY,
      code: `${IMPORTS}\nexport const uiFlags = { disableValidationBanner: true };`,
    },
    {
      name: "the failure branch the message asks for instead of the opt-out",
      filename: REPOSITORY,
      code: `${IMPORTS}\nimport { Either } from "effect";\nexport const parseInvoice = (payload: unknown) =>\n  Either.match(Schema.decodeUnknownEither(Invoice)(payload), {\n    onLeft: (error) => ({ ok: false as const, error }),\n    onRight: (invoice) => ({ ok: true as const, invoice }),\n  });`,
    },
    {
      name: "a test file sits outside the architecture contract by the catalog default",
      filename: "/repo/src/features/billing/service/invoice-repository.test.ts",
      code: `${IMPORTS}\nconst fixture = Invoice.make({ id: "inv_1" }, { disableValidation: true });`,
    },
    {
      name: "a one-off script is not the shipped module graph",
      filename: "/repo/scripts/backfill-invoices.ts",
      code: `${IMPORTS}\nconst row = Invoice.make({ id: "inv_1" }, { disableValidation: true });`,
    },
  ],
});
