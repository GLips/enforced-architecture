import { describeRule } from "../lib/rule-spec.ts";
import { noRuntimeTypeofRule } from "./no-runtime-typeof.ts";

const SERVICE = "/repo/src/features/billing/service/invoices.ts";

describeRule("types/no-runtime-typeof", noRuntimeTypeofRule, {
  obvious: [
    {
      name: "the narrowing the rule is named for",
      filename: SERVICE,
      code: `export function use(input: unknown): void { if (typeof input === "string") useName(input); }`,
      errors: [{ messageId: "runtimeTypeof" }],
    },
    {
      name: "the negated spelling",
      filename: SERVICE,
      code: `export function use(input: unknown): void { if (typeof input !== "string") return; }`,
      errors: [{ messageId: "runtimeTypeof" }],
    },
  ],

  adversarial: [
    {
      name: "used as a value rather than in a comparison",
      filename: SERVICE,
      code: `export const kind = typeof input;`,
      errors: [{ messageId: "runtimeTypeof" }],
    },
    {
      name: "inside a ternary rather than an if",
      filename: SERVICE,
      code: `export const name = typeof input === "string" ? input : "";`,
      errors: [{ messageId: "runtimeTypeof" }],
    },
    {
      name: "in a switch discriminant",
      filename: SERVICE,
      code: `export function use(input: unknown): void { switch (typeof input) { default: return; } }`,
      errors: [{ messageId: "runtimeTypeof" }],
    },
    {
      // Documented cost, asserted so nobody adopts this rule believing otherwise: the SSR guard is
      // correct code and this rule rejects it.
      name: "the environment guard, which is correct code and still reports",
      filename: SERVICE,
      code: `export const isServer = typeof window === "undefined";`,
      errors: [{ messageId: "runtimeTypeof" }],
    },
    {
      // The other documented cost: discriminating a union the compiler already narrowed. This tier
      // has no type information and cannot tell it from parsing by eye.
      name: "discriminating an already-typed union also reports",
      filename: SERVICE,
      code: `export function read(node: { value: string | number }): string { return typeof node.value === "string" ? node.value : ""; }`,
      errors: [{ messageId: "runtimeTypeof" }],
    },
    {
      name: "two checks in one expression are two findings",
      filename: SERVICE,
      code: `export const ok = typeof a === "string" && typeof b === "number";`,
      errors: [{ messageId: "runtimeTypeof" }, { messageId: "runtimeTypeof" }],
    },
    {
      // The nearest enclosing function decides. A closure inside a guard has no predicate of its
      // own, so the check has drifted away from the signature that vouches for it.
      name: "a closure nested inside a type guard is not covered by it",
      filename: SERVICE,
      code: `export function isInvoice(value: unknown): value is Invoice { const check = () => typeof value === "object"; return check(); }`,
      errors: [{ messageId: "runtimeTypeof" }],
    },
    {
      // An overload set that promises no predicate is not a guard, however guard-shaped the name
      // is. Pins that the exemption reads the signature rather than merely noticing one exists.
      name: "an overload signature without a predicate is not a guard",
      filename: SERVICE,
      code: `function isInvoiceId(value: unknown): boolean;
function isInvoiceId(value: unknown): boolean { return typeof value === "string"; }`,
      errors: [{ messageId: "runtimeTypeof" }],
    },
    {
      // The overload search matches by name. A predicate declared for a DIFFERENT function in the
      // same file must not vouch for this body.
      name: "a predicate overload for another function does not cover this one",
      filename: SERVICE,
      code: `function isInvoice(value: unknown): value is Invoice;
function isInvoice(value: unknown): boolean { return value !== null; }
function isInvoiceId(value: unknown): boolean { return typeof value === "string"; }`,
      errors: [{ messageId: "runtimeTypeof" }],
    },
    {
      // Same shape as a guard, minus the predicate — the narrowing stays private to this body
      // instead of becoming a contract, so it reports.
      name: "a throwing narrower without a predicate is not a guard",
      filename: SERVICE,
      code: `export function requireString(value: unknown): string { if (typeof value !== "string") throw new Error("not a string"); return value; }`,
      errors: [{ messageId: "runtimeTypeof" }],
    },
  ],

  legal: [
    {
      // The type-level operator is a different node entirely (TSTypeQuery). A rule that matched on
      // source text rather than node type would report here and be unusable.
      name: "TypeScript's type-level typeof is a different node",
      filename: SERVICE,
      code: `export type Config = typeof defaultConfig;`,
    },
    {
      name: "a ReturnType query built on the same type-level operator",
      filename: SERVICE,
      code: `export type Rows = ReturnType<typeof selectInvoiceRows>;`,
    },
    {
      name: "the fix the message asks for — parse, then branch on the domain value",
      filename: SERVICE,
      code: `export function use(input: unknown): void { const invoice = invoiceSchema.parse(input); if (invoice.status === "paid") settle(invoice); }`,
    },
    {
      name: "instanceof is a different operator and out of scope",
      filename: SERVICE,
      code: `export const isError = value instanceof Error;`,
    },
    {
      // The one runtime home for a representation check: the predicate turns it into a named
      // contract every caller narrows through.
      name: "a typeof check in the body of a type predicate",
      filename: SERVICE,
      code: `export function isInvoiceId(value: unknown): value is InvoiceId { return typeof value === "string"; }`,
    },
    {
      name: "the arrow spelling of the same guard",
      filename: SERVICE,
      code: `export const isInvoiceId = (value: unknown): value is InvoiceId => typeof value === "string";`,
    },
    {
      // TypeScript puts the predicate on the OVERLOAD and widens the implementation's return type,
      // so a rule reading only the body's own annotation rejects a guard whose published contract
      // is exactly what it exempts.
      name: "an overloaded guard declares its predicate on the signature",
      filename: SERVICE,
      code: `export function isInvoiceId(value: unknown): value is InvoiceId;
export function isInvoiceId(value: unknown): boolean { return typeof value === "string"; }`,
    },
    {
      name: "an assertion function is a guard that throws instead of returning false",
      filename: SERVICE,
      code: `export function assertInvoiceId(value: unknown): asserts value is InvoiceId { if (typeof value !== "string") throw new Error("not an InvoiceId"); }`,
    },
    {
      name: "a test file may inspect representations freely",
      filename: "/repo/src/features/billing/service/invoices.test.ts",
      code: `if (typeof result === "string") assert.ok(result);`,
    },
    {
      name: "a one-off script is not shipped module graph",
      filename: "/repo/scripts/backfill-invoices.ts",
      code: `const isServer = typeof window === "undefined";`,
    },
  ],
});
