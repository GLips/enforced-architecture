import { describeRule } from "../lib/rule-spec.ts";
import { noKnownValueWideningRule } from "./no-known-value-widening.ts";

const SERVICE = "/repo/src/features/billing/service/invoices.ts";

describeRule("types/no-known-value-widening", noKnownValueWideningRule, {
  obvious: [
    {
      // The motivating case. The VALUE type is precise; what the annotation deletes is the KEYS.
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
