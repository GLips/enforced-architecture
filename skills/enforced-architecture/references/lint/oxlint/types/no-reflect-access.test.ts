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
      // The merge. TypeScript folds these two declarations into ONE binding with
      // two definitions, and between them they bind nothing at run time — the file
      // compiles under `--strict` and emits the call verbatim. Reading the
      // variable rather than each definition said "this file binds Reflect".
      name: "an interface merged with an ambient const still binds no value",
      filename: SERVICE,
      code: `interface Reflect { get(o: unknown, k: string): unknown }
declare const Reflect: Reflect;
export const value = Reflect.get(invoice, key);`,
      errors: [{ messageId: "reflectGet" }],
    },
    {
      // A namespace with no value members is erased at emit, so the call is still
      // the builtin's. One line, and it reads as ordinary organisation.
      name: "an uninstantiated namespace named Reflect is erased",
      filename: SERVICE,
      code: `namespace Reflect { export type Key = string }
declare const named: Reflect.Key;
export const value = Reflect.get(invoice, named);`,
      errors: [{ messageId: "reflectGet" }],
    },
    {
      // The same read with a node wedged in, and a bypass a reader cannot see —
      // the source still says `Reflect.get`.
      name: "an assertion wrapped around the owner is the same read",
      filename: SERVICE,
      code: `export const value = (Reflect as never).get(invoice, key);`,
      errors: [{ messageId: "reflectGet" }],
    },
    {
      name: "a non-null assertion wrapped around the owner is the same read",
      filename: SERVICE,
      code: `export const value = Reflect!.get(invoice, key);`,
      errors: [{ messageId: "reflectGet" }],
    },
    {
      // The cheapest one of all in a real project: `import Reflect = NodeJS` needs
      // only `@types/node`, and `= JSX` only React. The alias erases to nothing, so
      // the call is the builtin's — and the definition claims `importKind: "value"`,
      // which is why the type-only arm above does not see it.
      name: "an alias to a type-space entity erases to nothing",
      filename: SERVICE,
      code: `namespace ReflectShim { export type Unused = string }
import Reflect = ReflectShim;
export const value = Reflect.get(invoice, key);`,
      errors: [{ messageId: "reflectGet" }],
    },
    {
      // Documented cost, asserted so nobody adopts this rule believing otherwise:
      // an INSTANTIATED namespace binds a real value and this still reports. Telling
      // it from the erased kind means reimplementing TypeScript's instantiation rule
      // out of one file's syntax, to buy silence on a namespace shadowing a language
      // builtin — while the erased half left open is a file-wide off-switch with no
      // bound. Here so that adding a heuristic later cannot leave the header stale.
      name: "an instantiated namespace is a real binding and still reports",
      filename: SERVICE,
      code: `namespace Reflect {
  export const get = (o, k) => o[k];
}
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
      // The narrowest real shadow there is — it binds for one call, and the object
      // is whatever the caller passed. Nothing in the rule branches on a parameter
      // specifically; this is here because the silence has to hold for every way a
      // file can bind the name, not just the ones the implementation names.
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
      // A reference is recorded on the scope that CONTAINS it, and for a `switch`
      // discriminant that is the scope ABOVE the one `getScope` returns. Looking in
      // one scope alone finds nothing, and a rule that fails open then reports on a
      // binding the file really does declare.
      name: "a shadow read as a switch discriminant is still a shadow",
      filename: SERVICE,
      code: `const Reflect = { get: (o, k) => o[k] };
export function classify(key) {
  switch (Reflect.get(invoice, key)) {
    case "paid":
      return 1;
    default:
      return 0;
  }
}`,
    },
    {
      // What separates resolving the REFERENCE from looking the NAME up, and the
      // only case that does. A name is bound by every declaration that spells it,
      // type space included, so the inner `type Reflect` hides the real `const`
      // outside and a name walk reports on a call that is genuinely local.
      name: "a type-space binding does not hide the real one outside it",
      filename: SERVICE,
      code: `const Reflect = { get: (o, k) => String(o[k]) };
export function read(key) {
  type Reflect = never;
  const unused: Reflect | undefined = undefined;
  return [Reflect.get({}, key), unused];
}`,
    },
    {
      // The `computed` argument to `staticKeyName`, which is the difference between
      // a key and a variable HOLDING one. The variable is named `apply` on purpose:
      // hardcoding the argument to `false` reads the identifier's own name as the
      // key, and only a variable named like a banned method shows that. A key this
      // file cannot follow names nothing, whatever the variable is called.
      name: "a computed key that is a variable names nothing statically",
      filename: SERVICE,
      code: `declare const apply: "ownKeys";
export const value = Reflect[apply](invoice, key);`,
    },
    {
      // `= require(…)` is the same syntax as the entity alias above and the opposite
      // verdict: it loads a module and binds it, so the call is not the builtin's.
      name: "an import-equals of a module is a real binding",
      filename: SERVICE,
      code: `import Reflect = require("./shim");
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
