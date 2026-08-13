import { describeRule } from "../lib/rule-spec.ts";
import { noUnknownReturnsRule } from "./no-unknown-returns.ts";

const SERVICE = "/repo/src/features/billing/service/invoices.ts";

describeRule("types/no-unknown-returns", noUnknownReturnsRule, {
  obvious: [
    {
      name: "the unknown return the rule is named for",
      filename: SERVICE,
      code: `export function loadInvoice(id: InvoiceId): unknown { return null; }`,
      errors: [{ messageId: "unknownReturn" }],
    },
    {
      name: "the async spelling, where the wrapper hides it one level down",
      filename: SERVICE,
      code: `export async function fetchInvoice(id: InvoiceId): Promise<unknown> { return null; }`,
      errors: [{ messageId: "unknownReturn" }],
    },
  ],

  adversarial: [
    {
      name: "the return type spelled through a local alias",
      filename: SERVICE,
      code: `type Loaded = unknown;
export function loadInvoice(): Loaded { return null; }`,
      errors: [{ messageId: "unknownReturn" }],
    },
    {
      name: "an alias declared below the signature that returns it",
      filename: SERVICE,
      code: `export function loadInvoice(): Loaded { return null; }
type Loaded = unknown;`,
      errors: [{ messageId: "unknownReturn" }],
    },
    {
      name: "a promise of an alias, two wrappers deep",
      filename: SERVICE,
      code: `type Loaded = unknown;
export async function fetchInvoice(): Promise<Loaded> { return null; }`,
      errors: [{ messageId: "unknownReturn" }],
    },
    {
      name: "an array of unknown is the same refusal in a container",
      filename: SERVICE,
      code: `export function loadInvoices(): unknown[] { return []; }`,
      errors: [{ messageId: "unknownReturn" }],
    },
    {
      name: "a readonly array of unknown",
      filename: SERVICE,
      code: `export function loadInvoices(): readonly unknown[] { return []; }`,
      errors: [{ messageId: "unknownReturn" }],
    },
    {
      name: "a union that collapses back to unknown",
      filename: SERVICE,
      code: `export function loadInvoice(): unknown | Invoice { return null; }`,
      errors: [{ messageId: "unknownReturn" }],
    },
    {
      name: "any is the same contract with the checking removed",
      filename: SERVICE,
      code: `export function loadInvoice(): any { return null; }`,
      errors: [{ messageId: "unknownReturn" }],
    },
    {
      name: "an arrow function assigned to a const",
      filename: SERVICE,
      code: `export const loadInvoice = (): unknown => null;`,
      errors: [{ messageId: "unknownReturn" }],
    },
    {
      name: "a method signature on an interface, which has no body",
      filename: SERVICE,
      code: `export interface Loader { load(id: InvoiceId): unknown }`,
      errors: [{ messageId: "unknownReturn" }],
    },
    {
      name: "a bare function type in a type position",
      filename: SERVICE,
      code: `export type Loader = (id: InvoiceId) => Promise<unknown>;`,
      errors: [{ messageId: "unknownReturn" }],
    },
    {
      name: "two broad contracts in one file are two findings",
      filename: SERVICE,
      code: `export function a(): unknown { return null; }
export function b(): Promise<any> { return Promise.resolve(null); }`,
      errors: [{ messageId: "unknownReturn" }, { messageId: "unknownReturn" }],
    },
  ],

  legal: [
    {
      name: "the named return the message asks for",
      filename: SERVICE,
      code: `export function loadInvoice(id: InvoiceId): Invoice { return read(id); }`,
    },
    {
      name: "a promise of a named type",
      filename: SERVICE,
      code: `export async function fetchInvoice(id: InvoiceId): Promise<Invoice> { return read(id); }`,
    },
    {
      // The rule reads declared contracts only. Catching an inferred `any` needs a type checker,
      // and a per-file rule that pretends otherwise is the kind that goes quietly wrong.
      name: "an inferred return is left to TypeScript",
      filename: SERVICE,
      code: `export function loadInvoice(text: string) { return JSON.parse(text); }`,
    },
    {
      // The mirror of the banned case, and the fix every other message in this tag points at:
      // unknown belongs on the INPUT of a parser, never on its output.
      name: "unknown as a parameter on a parser that returns a named type",
      filename: SERVICE,
      code: `export function parseInvoice(input: unknown): Invoice { return invoiceSchema.parse(input); }`,
    },
    {
      name: "a type parameter that shadows an alias name",
      filename: SERVICE,
      code: `type Loaded = unknown;
export function identity<Loaded>(value: Loaded): Loaded { return value; }`,
    },
    {
      name: "a generic alias is not resolved through",
      filename: SERVICE,
      code: `type Boxed<T> = T;
export function loadInvoice(): Boxed<Invoice> { return read(); }`,
    },
    {
      name: "a tuple with a known slot is a structure, not a refusal",
      filename: SERVICE,
      code: `export function split(): [Invoice, string] { return [read(), "ok"]; }`,
    },
    {
      name: "a test file stages whatever signature it needs",
      filename: "/repo/src/features/billing/service/invoices.test.ts",
      code: `function loadFixture(): unknown { return {}; }`,
    },
    {
      name: "a one-off script is not shipped module graph",
      filename: "/repo/scripts/backfill-invoices.ts",
      code: `function readRow(): Promise<unknown> { return Promise.resolve(null); }`,
    },
  ],
});
