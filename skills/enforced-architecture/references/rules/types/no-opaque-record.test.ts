import { describeRule } from "../lib/rule-spec.ts";
import { noOpaqueRecordRule } from "./no-opaque-record.ts";

const SERVICE = "/repo/src/features/billing/service/invoices.ts";
const COMPONENT = "/repo/src/features/billing/ui/invoice-list.tsx";

describeRule("types/no-opaque-record", noOpaqueRecordRule, {
  obvious: [
    {
      name: "the type the rule is named for, on an exported signature",
      filename: SERVICE,
      code: `export function summarize(invoice: Record<string, unknown>): string { return String(invoice.id); }`,
      errors: [{ messageId: "opaqueRecord" }],
    },
    {
      name: "a type alias that is nothing but the bag",
      filename: SERVICE,
      code: `export type InvoicePayload = Record<string, unknown>;`,
      errors: [{ messageId: "opaqueRecord" }],
    },
  ],

  adversarial: [
    {
      // The spelling that beats a rule matching only `Record<…>` — and the one an agent writes
      // without meaning to evade anything, since both forms are idiomatic for the same type.
      name: "the index-signature spelling of the same type",
      filename: SERVICE,
      code: `export type InvoicePayload = { [key: string]: unknown };`,
      errors: [{ messageId: "opaqueIndexSignature" }],
    },
    {
      name: "the index signature declared on an interface rather than a type literal",
      filename: SERVICE,
      code: `export interface InvoicePayload { id: string; [key: string]: unknown }`,
      errors: [{ messageId: "opaqueIndexSignature" }],
    },
    {
      name: "the mapped-type spelling over an open key domain",
      filename: SERVICE,
      code: `export type InvoicePayload = { [K in string]: unknown };`,
      errors: [{ messageId: "opaqueIndexSignature" }],
    },
    {
      // Banning `unknown` alone teaches the retry: `any` is the same bag with the checking removed.
      name: "the any-valued variant an agent reaches for on the retry",
      filename: SERVICE,
      code: `export function summarize(invoice: Record<string, any>): string { return String(invoice.id); }`,
      errors: [{ messageId: "opaqueRecord" }],
    },
    {
      name: "buried inside other generics rather than written at the top level",
      filename: SERVICE,
      code: `export async function loadInvoices(): Promise<Array<Record<string, unknown>>> { return []; }`,
      errors: [{ messageId: "opaqueRecord" }],
    },
    {
      name: "a non-string key is the same bag",
      filename: SERVICE,
      code: `export type InvoicesById = Record<number, unknown>;`,
      errors: [{ messageId: "opaqueRecord" }],
    },
    {
      name: "in a type assertion, where no declaration site is involved",
      filename: SERVICE,
      code: `export const asBag = (input: unknown) => input as Record<string, unknown>;`,
      errors: [{ messageId: "opaqueRecord" }],
    },
    {
      name: "as a generic constraint",
      filename: SERVICE,
      code: `export function merge<T extends Record<string, unknown>>(a: T, b: T): T { return { ...a, ...b }; }`,
      errors: [{ messageId: "opaqueRecord" }],
    },
    {
      name: "spread across lines, where no single line reads as the banned type",
      filename: COMPONENT,
      code: `export type InvoiceRowProps = Record<
  string,
  unknown
>;`,
      errors: [{ messageId: "opaqueRecord" }],
    },
    {
      // Locks in the parser behaviour the rule leans on: parentheses are not a node here, so the
      // value test sees the bare keyword. If a future oxlint surfaces TSParenthesizedType, this is
      // the case that goes red instead of the rule going quietly silent.
      name: "parentheses around the value type are not an escape",
      filename: SERVICE,
      code: `export type InvoicePayload = Record<string, (unknown)>;`,
      errors: [{ messageId: "opaqueRecord" }],
    },
    {
      // `object` as a VALUE is the same bag: it admits every non-primitive and no property can be
      // read off it without a cast. Banning only unknown/any teaches this as the third retry.
      name: "the object-valued variant, after unknown and any are both refused",
      filename: SERVICE,
      code: `export type InvoicePayload = Record<string, object>;`,
      errors: [{ messageId: "opaqueRecord" }],
    },
    {
      name: "the object-valued index signature",
      filename: SERVICE,
      code: `export type InvoicePayload = { [key: string]: object };`,
      errors: [{ messageId: "opaqueIndexSignature" }],
    },
    {
      // TypeScript collapses `unknown | string` to `unknown`, so the second member is cover, not
      // a contract. The bag is identical; only the spelling changed.
      name: "a union that collapses back to unknown",
      filename: SERVICE,
      code: `export type InvoicePayload = Record<string, unknown | string>;`,
      errors: [{ messageId: "opaqueRecord" }],
    },
    {
      name: "the value spelled through a local alias",
      filename: SERVICE,
      code: `type Opaque = unknown;
export type InvoicePayload = Record<string, Opaque>;`,
      errors: [{ messageId: "opaqueRecord" }],
    },
    {
      name: "a two-step alias chain to the same bag",
      filename: SERVICE,
      code: `type Opaque = unknown;
type Bag = Record<string, Opaque>;
export type InvoicePayload = Bag;`,
      errors: [{ messageId: "opaqueRecord" }],
    },
    {
      // The alias is declared BELOW the use that resolves through it. A rule collecting aliases
      // as it walks rather than up front reports nothing here.
      name: "an alias declared after the type that resolves through it",
      filename: SERVICE,
      code: `export type InvoicePayload = Record<string, Opaque>;
type Opaque = unknown;`,
      errors: [{ messageId: "opaqueRecord" }],
    },
    {
      name: "two bags in one file are two findings, not one",
      filename: SERVICE,
      code: `export type Payload = Record<string, unknown>;
export type Meta = { [key: string]: any };`,
      errors: [{ messageId: "opaqueRecord" }, { messageId: "opaqueIndexSignature" }],
    },
  ],

  legal: [
    {
      name: "a Record with a concrete value type is a keyed collection, not a bag",
      filename: SERVICE,
      code: `export type InvoicesById = Record<string, Invoice>;`,
    },
    {
      name: "an index signature with a concrete value type",
      filename: SERVICE,
      code: `export type InvoicesBySlug = { [slug: string]: Invoice };`,
    },
    {
      name: "the named-type fix the message asks for",
      filename: SERVICE,
      code: `export interface InvoicePayload { id: string; total: number; issuedAt: Date }`,
    },
    {
      name: "bare unknown is the correct way to receive unvalidated input",
      filename: SERVICE,
      code: `export const parseInvoice = (input: unknown): Invoice => invoiceSchema.parse(input);`,
    },
    {
      name: "a Map is a real keyed collection with a checked API",
      filename: SERVICE,
      code: `export const cache = new Map<string, unknown>();`,
    },
    {
      // Worth keeping loud: the upstream rule this one is modelled on reports here. `keyof T`
      // closes the key domain, so a dirty-field tracker is a precise type, not a bag — and a rule
      // that flags it trains people to disable the rule rather than fix the type.
      name: "a shape-preserving mapped type has a closed key domain",
      filename: SERVICE,
      code: `export type Touched<T> = { [K in keyof T]: unknown };`,
    },
    {
      name: "a union with no unknown or any member is a real contract",
      filename: SERVICE,
      code: `export type InvoiceField = Record<string, string | number>;`,
    },
    {
      name: "an alias to a concrete type is not followed anywhere bad",
      filename: SERVICE,
      code: `type Amount = number;
export type Totals = Record<string, Amount>;`,
    },
    {
      // A generic alias is deliberately not followed: its body is written in terms of parameters
      // this tier cannot substitute, so resolving it would report against a type argument that
      // may never be opaque at any real call site.
      name: "a generic alias is not resolved through",
      filename: SERVICE,
      code: `type Boxed<T> = T;
export type Totals = Record<string, Boxed<number>>;`,
    },
    {
      name: "Record<string, never> is the empty-object idiom, not a bag",
      filename: SERVICE,
      code: `export type NoProps = Record<string, never>;`,
    },
    {
      name: "a one-argument Record-like generic that merely shares the name shape",
      filename: SERVICE,
      code: `export type Rows = ReadonlyArray<Record<string, string>>;`,
    },
    {
      name: "a test file may spell a fixture however it likes",
      filename: "/repo/src/features/billing/service/invoices.test.ts",
      code: `const fixture: Record<string, unknown> = { id: "inv_1" };`,
    },
    {
      name: "a one-off script is not shipped module graph",
      filename: "/repo/scripts/backfill-invoices.ts",
      code: `const row: Record<string, unknown> = {};`,
    },
  ],
});
