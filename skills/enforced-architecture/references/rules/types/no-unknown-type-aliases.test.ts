import { describeRule } from "../lib/rule-spec.ts";
import { noUnknownTypeAliasesRule } from "./no-unknown-type-aliases.ts";

const SERVICE = "/repo/src/features/billing/service/invoices.ts";

describeRule("types/no-unknown-type-aliases", noUnknownTypeAliasesRule, {
  obvious: [
    {
      name: "the alias the rule is named for",
      filename: SERVICE,
      code: `export type ExternalValue = unknown;`,
      errors: [{ messageId: "unknownAlias" }],
    },
    {
      name: "the any-valued spelling of the same empty name",
      filename: SERVICE,
      code: `export type ApiPayload = any;`,
      errors: [{ messageId: "unknownAlias" }],
    },
  ],

  adversarial: [
    {
      // Both names are empty, so both report. Reporting only the leaf would leave the name a
      // reader actually writes untouched.
      name: "an alias chain, where every link is its own empty name",
      filename: SERVICE,
      code: `type ExternalValue = unknown;
export type ApiPayload = ExternalValue;`,
      errors: [{ messageId: "unknownAlias" }, { messageId: "unknownAlias" }],
    },
    {
      name: "the chain written in reverse order, resolving downwards",
      filename: SERVICE,
      code: `export type ApiPayload = ExternalValue;
type ExternalValue = unknown;`,
      errors: [{ messageId: "unknownAlias" }, { messageId: "unknownAlias" }],
    },
    {
      name: "not exported, and still a name that promises nothing",
      filename: SERVICE,
      code: `type ExternalValue = unknown;`,
      errors: [{ messageId: "unknownAlias" }],
    },
    {
      name: "a union that collapses back to unknown",
      filename: SERVICE,
      code: `export type ApiPayload = unknown | Invoice;`,
      errors: [{ messageId: "unknownAlias" }],
    },
    {
      name: "wrapped in a promise, which changes nothing about the payload",
      filename: SERVICE,
      code: `export type Pending = Promise<unknown>;`,
      errors: [{ messageId: "unknownAlias" }],
    },
    {
      name: "an array of unknown",
      filename: SERVICE,
      code: `export type Rows = unknown[];`,
      errors: [{ messageId: "unknownAlias" }],
    },
    {
      // A self-referential alias is not legal TypeScript, but it must not hang the linter either.
      // This asserts termination, which no amount of reading the recursion proves.
      name: "a self-referential alias terminates instead of recursing forever",
      filename: SERVICE,
      code: `type Loop = Loop;
export type Payload = unknown;`,
      errors: [{ messageId: "unknownAlias" }],
    },
  ],

  legal: [
    {
      name: "an alias to a real contract",
      filename: SERVICE,
      code: `export type InvoicePayload = { id: string; total: number };`,
    },
    {
      name: "an alias to a named type",
      filename: SERVICE,
      code: `export type Loaded = Invoice;`,
    },
    {
      // The rule is about aliases that hide unknown, not about unknown itself. A parser signature
      // is where unknown is honest, and this rule must not reach it.
      name: "unknown used inline at a parse boundary is untouched",
      filename: SERVICE,
      code: `export function parseInvoice(input: unknown): Invoice { return invoiceSchema.parse(input); }`,
    },
    {
      name: "a generic alias is not resolved through",
      filename: SERVICE,
      code: `export type Boxed<T> = T;`,
    },
    {
      name: "a union with no broad member",
      filename: SERVICE,
      code: `export type Status = "draft" | "paid";`,
    },
    {
      name: "an interface is not an alias",
      filename: SERVICE,
      code: `export interface InvoicePayload { id: string }`,
    },
    {
      name: "a test file may name a fixture type however it likes",
      filename: "/repo/src/features/billing/service/invoices.test.ts",
      code: `type Fixture = unknown;`,
    },
    {
      name: "a one-off script is not shipped module graph",
      filename: "/repo/scripts/backfill-invoices.ts",
      code: `type Row = unknown;`,
    },
  ],
});
