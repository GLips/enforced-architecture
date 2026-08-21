import { describeRule } from "../lib/rule-spec.ts";
import { noBroadParametersRule } from "./no-broad-parameters.ts";

const SERVICE = "/repo/src/features/billing/service/invoices.ts";

describeRule("types/no-broad-parameters", noBroadParametersRule, {
  obvious: [
    {
      name: "the unknown input the rule is named for",
      filename: SERVICE,
      code: `export function handle(input: unknown): void {}`,
      errors: [{ messageId: "unknownParameter" }],
    },
    {
      name: "the object input, the quieter half of the same refusal",
      filename: SERVICE,
      code: `export function save(value: object): void {}`,
      errors: [{ messageId: "objectParameter" }],
    },
  ],

  adversarial: [
    {
      // Banning the keyword alone teaches the rename. The alias reads as tidy code, which is what
      // makes it the spelling an agent lands on without meaning to evade anything.
      name: "the type spelled through a local alias",
      filename: SERVICE,
      code: `type Payload = unknown;
export function handle(input: Payload): void {}`,
      errors: [{ messageId: "unknownParameter" }],
    },
    {
      name: "an alias declared below the signature that uses it",
      filename: SERVICE,
      code: `export function handle(input: Payload): void {}
type Payload = unknown;`,
      errors: [{ messageId: "unknownParameter" }],
    },
    {
      name: "a union that collapses straight back to unknown",
      filename: SERVICE,
      code: `export function handle(input: unknown | string): void {}`,
      errors: [{ messageId: "unknownParameter" }],
    },
    {
      name: "a rest parameter, whose annotation hangs off a different node",
      filename: SERVICE,
      code: `export function handleAll(...inputs: unknown[]): void {}`,
      errors: [{ messageId: "unknownParameter" }],
    },
    {
      name: "a defaulted parameter, where the annotation sits on the pattern",
      filename: SERVICE,
      code: `export function handle(input: unknown = null): void {}`,
      errors: [{ messageId: "unknownParameter" }],
    },
    {
      name: "a constructor parameter property",
      filename: SERVICE,
      code: `export class Handler { constructor(private readonly input: unknown) {} }`,
      errors: [{ messageId: "unknownParameter" }],
    },
    {
      name: "an arrow function assigned to a const, not a declaration",
      filename: SERVICE,
      code: `export const handle = (input: unknown): void => {};`,
      errors: [{ messageId: "unknownParameter" }],
    },
    {
      name: "a method signature on an interface, which has no function body at all",
      filename: SERVICE,
      code: `export interface Handler { handle(input: unknown): void }`,
      errors: [{ messageId: "unknownParameter" }],
    },
    {
      name: "a bare function type in a type position",
      filename: SERVICE,
      code: `export type Handler = (input: unknown) => void;`,
      errors: [{ messageId: "unknownParameter" }],
    },
    {
      name: "any is the same refusal with the checking removed",
      filename: SERVICE,
      code: `export function handle(input: any): void {}`,
      errors: [{ messageId: "unknownParameter" }],
    },
    {
      // `cause` is exempt by NAME. A second unknown parameter beside it must still report, or the
      // carve-out becomes a way to launder one extra input per signature.
      name: "an unknown parameter sitting next to the exempt cause",
      filename: SERVICE,
      code: `export function wrap(cause: unknown, detail: unknown): Error { return new Error("x", { cause }); }`,
      errors: [{ messageId: "unknownParameter" }],
    },
    {
      // The exemption reaches the value the predicate NAMES and no further. Letting a guard's
      // return annotation clear its whole parameter list turns `value is T` into one free
      // `unknown` per extra argument.
      name: "a second broad input beside the value a guard vouches for",
      filename: SERVICE,
      code: `export function isInvoiceId(value: unknown, options: unknown): value is InvoiceId { return typeof value === "string"; }`,
      errors: [{ messageId: "unknownParameter" }],
    },
    {
      // Guard-shaped naming is not a guard. Keying the exemption off the name instead of the
      // return annotation would be the curated list this catalog refuses.
      name: "a guard-shaped name that promises no predicate",
      filename: SERVICE,
      code: `export function isInvoiceId(value: unknown): boolean { return typeof value === "string"; }`,
      errors: [{ messageId: "unknownParameter" }],
    },
    {
      // An overload set that promises no predicate is not a guard, so BOTH the signature and the
      // implementation answer for their own inputs.
      name: "an overload set with no predicate exempts neither of its signatures",
      filename: SERVICE,
      code: `function isInvoiceId(value: unknown): boolean;
function isInvoiceId(value: unknown): boolean { return typeof value === "string"; }`,
      errors: [{ messageId: "unknownParameter" }, { messageId: "unknownParameter" }],
    },
    {
      // The method overload set is matched on `static` as well as name. TypeScript will not pair a
      // static signature with an instance implementation, so reading them as one set would exempt
      // an input nothing vouched for.
      name: "a static predicate signature does not vouch for the instance method beside it",
      filename: SERVICE,
      code: `export class Guards { static isId(value: unknown): value is InvoiceId; static isId(value: unknown): boolean { return value !== null; } isId(candidate: unknown): boolean { return candidate !== null; } }`,
      errors: [{ messageId: "unknownParameter" }],
    },
    {
      // `this is T` narrows the receiver, which is not in `params` at all. Reading the predicate's
      // subject as "whatever sits first" would exempt an unrelated argument.
      name: "a predicate over this names no parameter and so exempts none",
      filename: SERVICE,
      code: `export class Invoice { isSettled(ledger: unknown): this is SettledInvoice { return Boolean(ledger); } }`,
      errors: [{ messageId: "unknownParameter" }],
    },
    {
      name: "both halves in one signature are two findings",
      filename: SERVICE,
      code: `export function merge(a: unknown, b: object): void {}`,
      errors: [{ messageId: "unknownParameter" }, { messageId: "objectParameter" }],
    },
    {
      // The infer binder is scoped to the TRUE branch. In the false branch the same name still
      // means the module alias, so the shadow must not leak across.
      name: "an infer name reused in the false branch still means the alias",
      filename: SERVICE,
      code: `type Item = object;
type Fallback<Input> = Input extends infer Item ? string : (value: Item) => void;`,
      errors: [{ messageId: "objectParameter" }],
    },
    {
      // The binder belongs to the NESTED conditional and is visible only in ITS true branch, so out
      // here `Item` is the module alias again. A collector that walks the whole extends clause
      // shadows the name and the rule goes silent — a false negative that reads exactly like the
      // scoping being handled correctly.
      name: "an infer binder inside a nested conditional does not shadow the outer true branch",
      filename: SERVICE,
      code: `type Item = object;
type Weird<Input> = Input extends (string extends infer Item ? true : false) ? (value: Item) => void : never;`,
      errors: [{ messageId: "objectParameter" }],
    },
  ],

  legal: [
    {
      name: "the cause convention, the one honest unknown input",
      filename: SERVICE,
      code: `export function wrapError(message: string, cause: unknown): Error { return new Error(message, { cause }); }`,
    },
    {
      // `types/no-runtime-typeof` tells you to write this signature. Reporting it would make the
      // two rules jointly unactionable — following one's message violates the other's.
      name: "a type predicate, the signature the guard rules ask for",
      filename: SERVICE,
      code: `export function isInvoiceId(value: unknown): value is InvoiceId { return typeof value === "string"; }`,
    },
    {
      name: "an assertion function, the same guard with the throw",
      filename: SERVICE,
      code: `export function assertInvoiceId(value: unknown): asserts value is InvoiceId { if (typeof value !== "string") throw new Error("not an InvoiceId"); }`,
    },
    {
      // `asserts value` with no `is` still parses to a TSTypePredicate, and it still vouches for
      // the input it names.
      name: "a bare asserts with no narrowed type",
      filename: SERVICE,
      code: `export function assertPresent(value: unknown): asserts value { if (value == null) throw new Error("absent"); }`,
    },
    {
      name: "a guard written as an arrow, where the predicate hangs off the expression",
      filename: SERVICE,
      code: `export const isInvoiceId = (value: unknown): value is InvoiceId => typeof value === "string";`,
    },
    {
      // The predicate lives on the SIGNATURE and the implementation widens its own return type, so
      // the implementation read alone vouches for nothing. It may also rename the parameter, which
      // is why the exemption travels by position rather than by the name the predicate uses.
      name: "an overloaded guard declares its predicate on the signature",
      filename: SERVICE,
      code: `export function isInvoiceId(value: unknown): value is InvoiceId;
export function isInvoiceId(candidate: unknown): boolean { return typeof candidate === "string"; }`,
    },
    {
      // The class spelling of the same overload set — a `MethodDefinition` holding a body-less
      // `TSEmptyBodyFunctionExpression`, with the name on a key rather than an id. Missing this
      // arm reports the input of a method `types/no-runtime-typeof` calls a correct guard.
      name: "an overloaded guard written as a method",
      filename: SERVICE,
      code: `export class Guards { isId(value: unknown): value is InvoiceId; isId(candidate: unknown): boolean { return typeof candidate === "string"; } }`,
    },
    {
      // An overload set may lead with a fast path that declares no predicate. Stopping at the
      // first same-name signature reads that one as the whole contract.
      name: "a predicate on the second overload still vouches for the implementation",
      filename: SERVICE,
      code: `export function isInvoiceId(value: InvoiceId): boolean;
export function isInvoiceId(value: unknown): value is InvoiceId;
export function isInvoiceId(candidate: unknown): boolean { return typeof candidate === "string"; }`,
    },
    {
      // Each signature in a set vouches for its own position, so the implementation collects every
      // one of them. Reading only the first leaves the second predicate's subject reporting.
      name: "an overload set whose signatures vouch for different positions",
      filename: SERVICE,
      code: `export function pick(a: unknown): a is InvoiceId;
export function pick(a: InvoiceId, b: unknown): b is Invoice;
export function pick(a: unknown, b?: unknown): boolean { return a !== null && b !== null; }`,
    },
    {
      // The exemption is about the POSITION a guard cannot type, not about which broad keyword
      // spells it — nagging this one into `unknown` is noise, not a contract.
      name: "a guard narrowing from object rather than unknown",
      filename: SERVICE,
      code: `export function isInvoiceRow(value: object): value is InvoiceRow { return "id" in value; }`,
    },
    {
      name: "the named type the message asks for",
      filename: SERVICE,
      code: `export function handle(input: InvoicePayload): void {}`,
    },
    {
      // The rule governs inputs, not the type. A parser taking `unknown` and returning a domain
      // type is the fix every other message in this tag points at — but it is still an input, and
      // it reports.
      name: "unknown as a RETURN is untouched by this rule",
      filename: SERVICE,
      code: `export function readRaw(): unknown { return null; }`,
    },
    {
      // A generic named after the keyword is not the keyword. Getting this wrong reads as the rule
      // being broken, which is what teaches people to disable it.
      name: "a type parameter that shadows an alias name",
      filename: SERVICE,
      code: `type Payload = unknown;
export function box<Payload>(input: Payload): Payload { return input; }`,
    },
    {
      name: "a generic alias is not resolved through",
      filename: SERVICE,
      code: `type Boxed<T> = T;
export function handle(input: Boxed<Invoice>): void {}`,
    },
    {
      name: "a union with no broad member is a real contract",
      filename: SERVICE,
      code: `export function handle(input: Invoice | Draft): void {}`,
    },
    {
      name: "Record with a concrete value is a keyed collection, not a refusal",
      filename: SERVICE,
      code: `export function handle(input: Record<string, Invoice>): void {}`,
    },
    {
      name: "a test file stages whatever signature it needs",
      filename: "/repo/src/features/billing/service/invoices.test.ts",
      code: `function handle(input: unknown): void {}`,
    },
    {
      name: "a one-off script is not shipped module graph",
      filename: "/repo/scripts/backfill-invoices.ts",
      code: `function handle(input: object): void {}`,
    },
    {
      name: "a mapped-type key that shadows an alias name",
      filename: SERVICE,
      code: `type Key = object;
type Mapped<Input> = { [Key in keyof Input]: (value: Key) => void };`,
    },
    {
      name: "an infer binder in the extends clause shadows an alias in the true branch",
      filename: SERVICE,
      code: `type Item = object;
type Unpacked<Input> = Input extends Promise<infer Item> ? (value: Item) => void : never;`,
    },
  ],
});
