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
      // The other half of the resolution, and the one a shadow check written as
      // "does the file bind this name anywhere" gets wrong. The binding exists,
      // and the use site is not inside it.
      name: "a Reflect bound inside another function does not cover the module-level use",
      filename: SERVICE,
      code: `function stubReflect() {
  const Reflect = { get: (o, k) => o[k] };
  return Reflect;
}
export const value = Reflect.get(invoice, key);`,
      errors: [{ messageId: "reflectGet" }],
    },
    {
      // An ambient declaration describes what already exists rather than binding
      // anything, so it is not a shadow — and a rule that counted it would hand
      // every adopter a one-line off-switch for the whole file.
      name: "an ambient declaration of Reflect is a description, not a shadow",
      filename: SERVICE,
      code: `declare const Reflect: { get(o: unknown, k: string): unknown };
export const value = Reflect.get(invoice, key);`,
      errors: [{ messageId: "reflectGet" }],
    },
    {
      // The CHEAPEST off-switch there is, and the one that reads as ordinary code
      // rather than as a suppression. It compiles under `--strict`, and the call
      // still returns `any`. Only resolving the reference sees this — a scope-chain
      // lookup by name finds the alias and goes quiet for the whole file.
      name: "a type alias named Reflect binds no value",
      filename: SERVICE,
      code: `type Reflect = never;
export const value = Reflect.get(invoice, key);`,
      errors: [{ messageId: "reflectGet" }],
    },
    {
      // The second type-space mechanism. `importKind` sits on the DECLARATION here
      // and on the SPECIFIER in the `import { type Reflect }` spelling, and the
      // resolver skips neither — so both have to be read, and this pins the pair.
      name: "a type-only import of Reflect binds no value",
      filename: SERVICE,
      code: `import type { Reflect } from "./shim.ts";
export type Use = Reflect;
export const value = Reflect.get(invoice, key);`,
      errors: [{ messageId: "reflectGet" }],
    },
    {
      name: "the inline type-only spelling of the same import",
      filename: SERVICE,
      code: `import { type Reflect } from "./shim.ts";
export type Use = Reflect;
export const value = Reflect.get(invoice, key);`,
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
      // binding that shadows the global is correctly untouched. NOTE that this case, and every
      // other one in this file, passes under a rule that reports NOTHING in the real linter:
      // RuleTester populates no global scope, and the global scope is what a resolution written
      // the obvious way trips over. See the rule header. The catalog proves the other half with
      // a real `oxlint` run, in `harness/prove-no-reflect-access-live.ts`.
      name: "a local binding named Reflect is not the global",
      filename: SERVICE,
      code: `const Reflect = { get: (o, k) => o[k] };
export const value = Reflect.get(invoice, key);`,
    },
    {
      // The binding is in an OUTER scope. Resolution handles this with no walk to
      // delete, so unlike the cases above this one pins BEHAVIOUR rather than a
      // line — it is what fails if anyone replaces the resolver with a lookup in
      // the starting scope alone.
      name: "a module-level Reflect covers a use inside a function",
      filename: SERVICE,
      code: `const Reflect = { get: (o, k) => o[k] };
export function read(key) {
  return Reflect.get(invoice, key);
}`,
    },
    {
      // A second DEFINITION KIND, because the branch that decides this reads the
      // binding's definition site rather than its scope: a parameter is declared
      // in a function scope, a `const` in the module scope, and the rule owes
      // both the same silence.
      name: "a parameter named Reflect is the caller's object, not the global",
      filename: SERVICE,
      code: `export function read(Reflect, key) {
  return Reflect.get(invoice, key);
}`,
    },
    {
      // The counterpart to the two type-only cases above: a VALUE import really
      // does bind the name, so the same syntax minus `type` must stay silent.
      // Without this the type-only arm could widen to all imports unnoticed.
      name: "a value import named Reflect is a real binding",
      filename: SERVICE,
      code: `import { Reflect } from "./shim.ts";
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
