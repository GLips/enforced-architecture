import { describeRule } from "../lib/rule-spec.ts";
import { noConditionalEmptyObjectSpreadRule } from "./no-conditional-empty-object-spread.ts";

const SERVICE = "/repo/src/features/billing/service/invoices.ts";

describeRule("types/no-conditional-empty-object-spread", noConditionalEmptyObjectSpreadRule, {
  obvious: [
    {
      name: "the hidden omission the rule is named for",
      filename: SERVICE,
      code: `export const options = { ...(timeout !== undefined ? { timeout } : {}) };`,
      errors: [{ messageId: "hiddenOmission" }],
    },
    {
      name: "alongside real properties, where it reads as one of them",
      filename: SERVICE,
      code: `export const options = { retries: 3, ...(timeout ? { timeout } : {}) };`,
      errors: [{ messageId: "hiddenOmission" }],
    },
  ],

  adversarial: [
    {
      // The condition is routinely written the other way round, putting the empty object first.
      name: "the empty branch first, with the condition negated",
      filename: SERVICE,
      code: `export const options = { ...(timeout === undefined ? {} : { timeout }) };`,
      errors: [{ messageId: "hiddenOmission" }],
    },
    {
      name: "spread across lines, where no single line reads as the pattern",
      filename: SERVICE,
      code: `export const options = {
  ...(timeout !== undefined
    ? { timeout }
    : {}),
};`,
      errors: [{ messageId: "hiddenOmission" }],
    },
    {
      name: "nested inside another object literal",
      filename: SERVICE,
      code: `export const request = { body: { ...(cursor ? { cursor } : {}) } };`,
      errors: [{ messageId: "hiddenOmission" }],
    },
    {
      // The density this rule actually exists to flag — the shape set here is eight.
      name: "three in one literal are three findings",
      filename: SERVICE,
      code: `export const options = {
  ...(a ? { a } : {}),
  ...(b ? { b } : {}),
  ...(c ? { c } : {}),
};`,
      errors: [
        { messageId: "hiddenOmission" },
        { messageId: "hiddenOmission" },
        { messageId: "hiddenOmission" },
      ],
    },
  ],

  legal: [
    {
      // Two real branches choose between things rather than hiding an absence, so the literal's
      // keys stay readable either way.
      name: "a conditional spread with two real branches",
      filename: SERVICE,
      code: `export const options = { ...(isAdmin ? adminDefaults : userDefaults) };`,
    },
    {
      name: "an unconditional spread",
      filename: SERVICE,
      code: `export const options = { ...defaults, retries: 3 };`,
    },
    {
      name: "the fix the message asks for — named steps",
      filename: SERVICE,
      code: `export function buildOptions(timeout?: number): Options {
  const options: Options = { retries: 3 };
  if (timeout !== undefined) options.timeout = timeout;
  return options;
}`,
    },
    {
      name: "a conditional property value rather than a conditional key",
      filename: SERVICE,
      code: `export const options = { timeout: timeout ?? DEFAULT_TIMEOUT };`,
    },
    {
      // The same shape outside an object literal is a different construct with none of the cost.
      name: "the same shape in an array is not this pattern",
      filename: SERVICE,
      code: `export const items = [...(extra ? [extra] : [])];`,
    },
    {
      name: "a test file may build fixtures however it likes",
      filename: "/repo/src/features/billing/service/invoices.test.ts",
      code: `const options = { ...(timeout ? { timeout } : {}) };`,
    },
    {
      name: "a one-off script is not shipped module graph",
      filename: "/repo/scripts/backfill-invoices.ts",
      code: `const options = { ...(cursor ? { cursor } : {}) };`,
    },
  ],
});
