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
      // The rest of the open key domain. Reading the key at all is what makes narrowing the open
      // set to `string` a bypass, so each member of it is pinned separately.
      name: "a symbol key is the same bag",
      filename: SERVICE,
      code: `export type InvoicesBySymbol = Record<symbol, unknown>;`,
      errors: [{ messageId: "opaqueRecord" }],
    },
    {
      name: "PropertyKey is every open key at once",
      filename: SERVICE,
      code: `export type AnythingAtAll = Record<PropertyKey, unknown>;`,
      errors: [{ messageId: "opaqueRecord" }],
    },
    {
      name: "keyof any is PropertyKey spelled the long way round",
      filename: SERVICE,
      code: `export type AnythingAtAll = Record<keyof any, unknown>;`,
      errors: [{ messageId: "opaqueRecord" }],
    },
    {
      // The header predicts `any` as the retry for the VALUE; it is the same retry in the key, and
      // one keystroke off `Record<string, unknown>`. A key predicate that enumerates the open
      // spellings rather than the closed ones goes silent here and reads as precision.
      name: "an any key domain is every key at once",
      filename: SERVICE,
      code: `export type AnythingAtAll = Record<any, unknown>;`,
      errors: [{ messageId: "opaqueRecord" }],
    },
    {
      // `string & {}` is the trick that stops a literal union widening, and reads as a narrowing
      // while admitting exactly the keys `string` does.
      name: "an intersection whose members are all open is open",
      filename: SERVICE,
      code: `export type InvoicePayload = Record<string & {}, unknown>;`,
      errors: [{ messageId: "opaqueRecord" }],
    },
    {
      // The autocomplete idiom: one literal beside an open domain. A union is closed only when
      // EVERY member is, or one named key buys silence for the infinity beside it.
      name: "a union mixing a literal with an open domain is open",
      filename: SERVICE,
      code: `export type InvoicePayload = Record<"draft" | string, unknown>;`,
      errors: [{ messageId: "opaqueRecord" }],
    },
    {
      // TS2456 rejects this, but the linter runs on parseable source, not compiling source. Without
      // the cycle guard the key walk recurses until the stack goes — a crash, not a false negative,
      // and the only fixture that can tell the difference is one that would not terminate.
      name: "a cyclic alias chain in key position terminates and reports",
      filename: SERVICE,
      code: `type First = Second;
type Second = First;
export type InvoicePayload = Record<First, unknown>;`,
      errors: [{ messageId: "opaqueRecord" }],
    },
    {
      name: "a template-literal key domain is infinite",
      filename: SERVICE,
      code: `export type InvoicePayload = Record<\`user_\${string}\`, unknown>;`,
      errors: [{ messageId: "opaqueRecord" }],
    },
    {
      // A generic string utility is not resolved through, so nothing here is known to be closed —
      // and the default has to be "open", or every unrecognised key spelling is a silent bypass.
      name: "a string utility type over an open domain stays open",
      filename: SERVICE,
      code: `export type InvoicePayload = Record<Lowercase<string>, unknown>;`,
      errors: [{ messageId: "opaqueRecord" }],
    },
    {
      name: "a union of open key domains is open",
      filename: SERVICE,
      code: `export type InvoicePayload = { [K in string | number]: unknown };`,
      errors: [{ messageId: "opaqueIndexSignature" }],
    },
    {
      // One keystroke off `{ [k: number]: unknown }`, and identical to it. A key predicate that
      // recognises only `string` calls this closed and goes quiet on the whole domain.
      name: "a mapped type over the number key domain",
      filename: SERVICE,
      code: `export type InvoicePayload = { [K in number]: unknown };`,
      errors: [{ messageId: "opaqueIndexSignature" }],
    },
    {
      name: "a mapped type over the symbol key domain",
      filename: SERVICE,
      code: `export type InvoicePayload = { [K in symbol]: unknown };`,
      errors: [{ messageId: "opaqueIndexSignature" }],
    },
    {
      // An alias BURIED IN A UNION — two spellings the header covers separately, combined. A union
      // arm testing members against literal keywords without recursing hands back the whole bag for
      // two tidy-looking lines.
      name: "a union member that is an alias to unknown",
      filename: SERVICE,
      code: `type Opaque = unknown;
export type InvoicePayload = Record<string, Opaque | string>;`,
      errors: [{ messageId: "opaqueRecord" }],
    },
    {
      // The retreat once `Record<string, object>` is refused. A union does not launder a broad
      // member — neither branch supports a property read without narrowing first.
      name: "an object value hidden in a union",
      filename: SERVICE,
      code: `export type InvoicePayload = Record<string, object | string>;`,
      errors: [{ messageId: "opaqueRecord" }],
    },
    {
      // The key domain hidden behind an alias. A closed domain buys silence, so an alias is the
      // cheapest way to spell an open one that does not look open.
      name: "an open key domain spelled through a local alias",
      filename: SERVICE,
      code: `type AnyKey = string;
export type InvoicePayload = { [K in AnyKey]: unknown };`,
      errors: [{ messageId: "opaqueIndexSignature" }],
    },
    {
      name: "a dictionary of unknown payloads wearing a Promise",
      filename: SERVICE,
      code: `export type PendingById = Record<string, Promise<unknown>>;`,
      errors: [{ messageId: "opaqueRecord" }],
    },
    {
      name: "a dictionary of unknown arrays",
      filename: SERVICE,
      code: `export type RowsById = Record<string, unknown[]>;`,
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
      // THE DIVERGENCE ROW. `types/no-known-value-widening` reports this exact type over a literal,
      // because the loss it watches is in the keys. This rule and `types/no-widen-then-assert`
      // share that key question and go on to ask whether the value is opaque, so both stay silent.
      // If this ever reports, the three rules have collapsed into one.
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
      // The same dirty-field tracker in the OTHER spelling, and it must read the same way. An arm
      // that reads the key and an arm that does not is one keystroke of disagreement.
      name: "the Record spelling of the same closed key domain",
      filename: SERVICE,
      code: `export type Touched<T> = Record<keyof T, unknown>;`,
    },
    {
      // NEGATIVE SPACE, stated in the header: the keys are closed so a misspelling is already a
      // compile error, but the reads still need casts and nothing in this catalog covers that.
      // A fixture rather than a comment, so the silence is a decision and not an accident.
      name: "a closed key domain with opaque values is out of scope, not covered",
      filename: SERVICE,
      code: `export type StatusPayloads = Record<"draft" | "paid", unknown>;`,
    },
    {
      // The alias is shadowed by a type parameter of the same name, so `Opaque` here is generic and
      // the annotation says nothing about `unknown`. Resolving through the module alias is a false
      // positive that reads as the rule being broken.
      name: "a type parameter that shadows a local alias is not resolved",
      filename: SERVICE,
      code: `type Opaque = unknown;
export function box<Opaque>(bag: Record<string, Opaque>): Opaque | undefined { return undefined; }`,
    },
    {
      // The same shadow in KEY position. `AnyKey` here is the mapped type's own binder-adjacent
      // type parameter, not the module alias, so the domain is whatever the caller supplies — and
      // resolving through the alias would report a generic utility as a bag.
      name: "a type parameter that shadows a local alias in key position",
      filename: SERVICE,
      code: `type AnyKey = string;
export type Bag<AnyKey> = { [K in AnyKey]: unknown };`,
    },
    {
      // The mapped type's own key binder shadows the module alias inside the VALUE position, and
      // only there — `[K in X]` cannot reference `K` in `X`. A rule computing one shadow set at the
      // mapped type reports this, because the walk never arrives from the value and never sees the
      // binder.
      name: "a mapped key binder shadows an alias of the same name in the value",
      filename: SERVICE,
      code: `type Key = unknown;
export type Slugs = { [Key in string]: Key };`,
    },
    {
      name: "a type parameter that shadows an alias in an index signature's value",
      filename: SERVICE,
      code: `type Opaque = unknown;
export function box<Opaque>(bag: { [k: string]: Opaque }): void {}`,
    },
    {
      // A local enum is a finite key set whose members are not TSTypes at all, so a walk that only
      // resolves type aliases sees an unknown name and, defaulting to open, reports the idiom the
      // rule's own message asks for.
      name: "a local enum is a closed key domain",
      filename: SERVICE,
      code: `enum Status { Draft, Paid }
export type StatusPayloads = Record<Status, unknown>;`,
    },
    {
      name: "an enum member names a single key",
      filename: SERVICE,
      code: `enum Status { Draft, Paid }
export type DraftPayload = Record<Status.Draft, unknown>;`,
    },
    {
      // The canonical TypeScript spelling of a closed key domain. Reporting it leaves no fix but a
      // disable comment, which is how a rule stops being enforced.
      name: "an indexed access over a const-asserted array is closed",
      filename: SERVICE,
      code: `const KEYS = ["draft", "paid"] as const;
export type StatusPayloads = Record<(typeof KEYS)[number], unknown>;`,
    },
    {
      name: "an indexed access into a named type is closed",
      filename: SERVICE,
      code: `export type ById = Record<Row["id"], unknown>;`,
    },
    {
      // `Exclude` and `Extract` hand back a subset of their first argument, so they are closed
      // exactly when it is. This is the ordinary way to write "some of T's keys".
      name: "a key-preserving builtin over a closed domain stays closed",
      filename: SERVICE,
      code: `export type Touched<T> = Record<Exclude<keyof T, "id">, unknown>;`,
    },
    {
      name: "Extract narrowing keyof to its string members",
      filename: SERVICE,
      code: `export type Touched<T> = Record<Extract<keyof T, string>, unknown>;`,
    },
    {
      name: "a case-mapping builtin over a literal union",
      filename: SERVICE,
      code: `export type Shouted = Record<Uppercase<"draft" | "paid">, unknown>;`,
    },
    {
      // A LOCAL alias to a literal union is resolved and found closed. The same union imported
      // from another module reports — stated as negative space in the header, and the direction
      // this failure has to run: a key spelling nobody recognises must report, not go quiet.
      name: "a local alias to a literal union is a closed key domain",
      filename: SERVICE,
      code: `type Status = "draft" | "paid";
export type StatusPayloads = Record<Status, unknown>;`,
    },
    {
      // An intersection is closed as soon as ANY member closes it, and `keyof T` does. This is the
      // ordinary spelling of "the string keys of T", not a bag.
      name: "an intersection narrowed by keyof is closed",
      filename: SERVICE,
      code: `export type Touched<T> = Record<keyof T & string, unknown>;`,
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
