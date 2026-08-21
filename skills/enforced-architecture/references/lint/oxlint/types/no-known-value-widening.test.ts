import { describeRule } from "../lib/rule-spec.ts";
import { noKnownValueWideningRule } from "./no-known-value-widening.ts";

const SERVICE = "/repo/src/features/billing/service/invoices.ts";

describeRule("types/no-known-value-widening", noKnownValueWideningRule, {
  obvious: [
    {
      // The motivating case, and THE DIVERGENCE ROW. The VALUE type is precise; what the annotation
      // deletes is the KEYS. `types/no-opaque-record` and `types/no-widen-then-assert` share the
      // key question with this rule and go on to ask whether the value is opaque, so both are
      // silent on this exact type and each pins it as legal. This is the fixture that proves the
      // three rules are not one rule — if it ever stops reporting here, the key/value split is gone.
      name: "a Record annotation over a literal with known keys",
      filename: SERVICE,
      code: `export const handlers: Record<string, Handler> = { start: startHandler, stop: stopHandler };`,
      errors: [{ messageId: "widening" }],
    },
    {
      name: "a top type over a value written out in front of you",
      filename: SERVICE,
      code: `export const config: unknown = { retries: 3 };`,
      errors: [{ messageId: "widening" }],
    },
  ],

  adversarial: [
    {
      name: "the index-signature spelling of the same annotation",
      filename: SERVICE,
      code: `export const handlers: { [key: string]: Handler } = { start: startHandler };`,
      errors: [{ messageId: "widening" }],
    },
    {
      name: "the object keyword, which deletes even the value types",
      filename: SERVICE,
      code: `export const config: object = { retries: 3 };`,
      errors: [{ messageId: "widening" }],
    },
    {
      name: "on a return statement rather than a declaration",
      filename: SERVICE,
      code: `export function buildHandlers(): Record<string, Handler> {
  return { start: startHandler };
}`,
      errors: [{ messageId: "widening" }],
    },
    {
      // A concise arrow body is a return with no ReturnStatement node, so a rule visiting only
      // ReturnStatement misses it entirely.
      name: "a concise arrow body, which has no return statement to visit",
      filename: SERVICE,
      code: `export const buildHandlers = (): Record<string, Handler> => ({ start: startHandler });`,
      errors: [{ messageId: "widening" }],
    },
    {
      name: "a class property initializer",
      filename: SERVICE,
      code: `export class Registry { handlers: Record<string, Handler> = { start: startHandler }; }`,
      errors: [{ messageId: "widening" }],
    },
    {
      name: "an array literal with known elements",
      filename: SERVICE,
      code: `export const statuses: unknown = ["draft", "paid"];`,
      errors: [{ messageId: "widening" }],
    },
    {
      name: "a mapped type is an open key domain too",
      filename: SERVICE,
      code: `export const flags: { [K in string]: boolean } = { beta: true };`,
      errors: [{ messageId: "widening" }],
    },
    {
      // The `as` clause replaces the key domain, so a mapped type can wear a closed CONSTRAINT and
      // still delete every key the literal has. Reading the constraint alone calls this a
      // shape-preserving map — one keystroke from the legal fixture below it.
      name: "a mapped type remapping closed keys to string still deletes them",
      filename: SERVICE,
      code: `export const handlers: { [K in keyof Config as string]: Handler } = { start: startHandler };`,
      errors: [{ messageId: "widening" }],
    },
    {
      name: "a mapped type over the number key domain",
      filename: SERVICE,
      code: `export const flags: { [K in number]: boolean } = { 1: true };`,
      errors: [{ messageId: "widening" }],
    },
    {
      name: "a mapped type over the symbol key domain",
      filename: SERVICE,
      code: `export const flags: { [K in symbol]: boolean } = { [beta]: true };`,
      errors: [{ messageId: "widening" }],
    },
    {
      name: "a number-keyed index signature",
      filename: SERVICE,
      code: `export const rows: { [k: number]: Row } = { 1: firstRow };`,
      errors: [{ messageId: "widening" }],
    },
    {
      // The bag reached through a local alias, declared below the use. Without the up-front
      // collection this is a one-line bypass that reads as tidy code rather than evasion.
      name: "the open dictionary spelled through a local alias",
      filename: SERVICE,
      code: `export const handlers: HandlerMap = { start: startHandler };
type HandlerMap = Record<string, Handler>;`,
      errors: [{ messageId: "widening" }],
    },
    {
      name: "a top type spelled through a local alias",
      filename: SERVICE,
      code: `type Opaque = unknown;
export const config: Opaque = { retries: 3 };`,
      errors: [{ messageId: "widening" }],
    },
    {
      name: "two widened declarations are two findings",
      filename: SERVICE,
      code: `export const a: unknown = { id: 1 };
export const b: Record<string, Handler> = { start: startHandler };`,
      errors: [{ messageId: "widening" }, { messageId: "widening" }],
    },
  ],

  legal: [
    {
      // The fix the message names. It checks every value against Handler AND keeps the keys.
      name: "satisfies checks the literal without widening it",
      filename: SERVICE,
      code: `export const handlers = { start: startHandler } satisfies Record<string, Handler>;`,
    },
    {
      name: "no annotation at all, which is what inference is for",
      filename: SERVICE,
      code: `export const handlers = { start: startHandler, stop: stopHandler };`,
    },
    {
      // The annotation is doing real work here: the accumulator is being given the type it will
      // grow into, and there is nothing to discard.
      name: "an empty object is an accumulator, not a discarded literal",
      filename: SERVICE,
      code: `export const handlers: Record<string, Handler> = {};`,
    },
    {
      name: "an empty array accumulator",
      filename: SERVICE,
      code: `export const rows: unknown[] = [];`,
    },
    {
      // Nothing was known, so nothing was discarded. This is a boundary, and what happens to the
      // value afterwards is types/no-widen-then-assert's business.
      name: "a value from a call was never precise to begin with",
      filename: SERVICE,
      code: `export const parsed: unknown = JSON.parse(text);`,
    },
    {
      // A closed key domain names exactly the keys the literal has, so nothing is deleted — the
      // same reading that keeps a dirty-field tracker legal in `types/no-opaque-record`.
      name: "a Record over a closed key domain deletes no keys",
      filename: SERVICE,
      code: `export const handlers: Record<"start" | "stop", Handler> = { start: startHandler, stop: stopHandler };`,
    },
    {
      // The annotation names the function's own type parameter, which happens to share a name with
      // a module alias to the bag. Resolving through the alias reports a generic helper for a
      // widening it never performs — the false positive that trains people to disable a rule.
      name: "a type parameter that shadows an alias to the bag is not resolved",
      filename: SERVICE,
      code: `type Bag = Record<string, Handler>;
export function build<Bag>(): Bag | undefined {
  const held: Bag = { start: startHandler };
  return undefined;
}`,
    },
    {
      // The sharpest form of the false positive this rule can produce: the annotation is doing real
      // work — it is the exhaustiveness check — and the message would tell the author to `satisfies`
      // it away, which deletes exactly the guarantee it was written for.
      name: "an enum key domain names every key the literal has",
      filename: SERVICE,
      code: `enum Status { Draft, Paid }
export const handlers: Record<Status, Handler> = { [Status.Draft]: startHandler, [Status.Paid]: stopHandler };`,
    },
    {
      name: "a const-asserted array's element type is a closed key domain",
      filename: SERVICE,
      code: `const KEYS = ["start", "stop"] as const;
export const handlers: Record<(typeof KEYS)[number], Handler> = { start: startHandler, stop: stopHandler };`,
    },
    {
      name: "a shape-preserving mapped type deletes no keys either",
      filename: SERVICE,
      code: `export const handlers: { [K in keyof Config]: Handler } = { start: startHandler };`,
    },
    {
      // TS2456 rejects this, but the linter runs on parseable source, not compiling source. Without
      // the cycle guard the DICTIONARY walk recurses until the stack goes — a crash, not a false
      // negative, and the only fixture that can tell the difference is one that would not
      // terminate. The key walk has a guard of its own with a fixture of its own; this is the other.
      name: "a cyclic alias chain in annotation position terminates",
      filename: SERVICE,
      code: `type First = Second;
type Second = First;
export const handlers: First = { start: startHandler };`,
    },
    {
      name: "a precise annotation over a literal is a real check",
      filename: SERVICE,
      code: `export const invoice: Invoice = { id: "inv_1", total: 10 };`,
    },
    {
      name: "a Record annotation on a value reached through another binding is not followed",
      filename: SERVICE,
      code: `const base = { start: startHandler };
export const handlers: Record<string, Handler> = base;`,
    },
    {
      name: "a test file may widen a fixture however it likes",
      filename: "/repo/src/features/billing/service/invoices.test.ts",
      code: `const handlers: Record<string, Handler> = { start: startHandler };`,
    },
    {
      name: "a one-off script is not shipped module graph",
      filename: "/repo/scripts/backfill-invoices.ts",
      code: `const config: unknown = { retries: 3 };`,
    },
  ],
});
