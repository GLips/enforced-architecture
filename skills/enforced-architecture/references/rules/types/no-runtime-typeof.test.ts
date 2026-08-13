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
      // correct code and this rule rejects it. See Adapt note 1.
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
