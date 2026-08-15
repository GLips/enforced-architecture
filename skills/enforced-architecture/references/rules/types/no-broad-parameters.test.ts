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
  ],

  legal: [
    {
      name: "the cause convention, the one honest unknown input",
      filename: SERVICE,
      code: `export function wrapError(message: string, cause: unknown): Error { return new Error(message, { cause }); }`,
    },
    {
      name: "the named type the message asks for",
      filename: SERVICE,
      code: `export function handle(input: InvoicePayload): void {}`,
    },
    {
      // The rule governs inputs, not the type. A parser taking `unknown` and returning a domain
      // type is the fix every other message in this tag points at — but it is still an input, so
      // the project exempts its parser directory by path rather than by weakening the match.
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
