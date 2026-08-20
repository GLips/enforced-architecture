import { describeRule } from "../lib/rule-spec.ts";
import { noReflectAccessRule } from "./no-reflect-access.ts";

const SERVICE = "/repo/src/features/billing/service/invoices.ts";

describeRule("types/no-reflect-access", noReflectAccessRule, {
  obvious: [
    {
      name: "the untyped property read",
      filename: SERVICE,
      code: `export const value = Reflect.get(invoice, key);`,
      errors: [{ messageId: "reflectGet" }],
    },
    {
      name: "the unchecked call",
      filename: SERVICE,
      code: `export const result = Reflect.apply(settle, invoice, args);`,
      errors: [{ messageId: "reflectApply" }],
    },
  ],

  adversarial: [
    {
      // One keystroke from the plain form, and invisible to a rule reading `property.name`.
      name: "the computed spelling of the same access",
      filename: SERVICE,
      code: `export const value = Reflect["get"](invoice, key);`,
      errors: [{ messageId: "reflectGet" }],
    },
    {
      name: "the computed spelling of apply",
      filename: SERVICE,
      code: `export const result = Reflect["apply"](settle, invoice, args);`,
      errors: [{ messageId: "reflectApply" }],
    },
    {
      name: "nested inside another call rather than assigned",
      filename: SERVICE,
      code: `export const total = sum(Reflect.get(invoice, "lines"));`,
      errors: [{ messageId: "reflectGet" }],
    },
    {
      name: "chained onto directly, so the call is not the outermost node",
      filename: SERVICE,
      code: `export const id = Reflect.get(invoice, "id").toString();`,
      errors: [{ messageId: "reflectGet" }],
    },
    {
      name: "both banned methods in one file are two findings",
      filename: SERVICE,
      code: `export const value = Reflect.get(invoice, key);
export const result = Reflect.apply(settle, invoice, args);`,
      errors: [{ messageId: "reflectGet" }, { messageId: "reflectApply" }],
    },
  ],

  legal: [
    {
      name: "the typed property access the message asks for",
      filename: SERVICE,
      code: `export const value = invoice.total;`,
    },
    {
      name: "calling the function directly",
      filename: SERVICE,
      code: `export const result = settle(invoice, ...args);`,
    },
    {
      name: "the rest of Reflect returns honest types and has no plain equivalent",
      filename: SERVICE,
      code: `export const keys = Reflect.ownKeys(invoice);`,
    },
    {
      name: "Reflect.has is a real membership test",
      filename: SERVICE,
      code: `export const present = Reflect.has(invoice, "total");`,
    },
    {
      // This is what separates the rule from a text search: the name is resolved, so a local
      // binding that shadows the global is correctly untouched.
      name: "a local binding named Reflect is not the global",
      filename: SERVICE,
      code: `const Reflect = { get: (o, k) => o[k] };
export const value = Reflect.get(invoice, key);`,
    },
    {
      name: "a same-named method on some other object",
      filename: SERVICE,
      code: `export const value = cache.get(key);`,
    },
    {
      name: "a test file may reach past the type system to stage a case",
      filename: "/repo/src/features/billing/service/invoices.test.ts",
      code: `const value = Reflect.get(fixture, "id");`,
    },
    {
      name: "a one-off script is not shipped module graph",
      filename: "/repo/scripts/backfill-invoices.ts",
      code: `const value = Reflect.get(row, key);`,
    },
  ],
});
