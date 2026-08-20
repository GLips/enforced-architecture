import { describeRule } from "../lib/rule-spec.ts";
import { noChainedTypeAssertionsRule } from "./no-chained-type-assertions.ts";

const SERVICE = "/repo/src/features/billing/service/invoices.ts";

describeRule("types/no-chained-type-assertions", noChainedTypeAssertionsRule, {
  obvious: [
    {
      name: "the double assertion the rule is named for",
      filename: SERVICE,
      code: `export const user = raw as unknown as User;`,
      errors: [{ messageId: "chained" }],
    },
    {
      name: "routed through any rather than unknown",
      filename: SERVICE,
      code: `export const user = raw as any as User;`,
      errors: [{ messageId: "chained" }],
    },
  ],

  adversarial: [
    {
      // Parentheses are how a person writes this when they think about it, and oxlint surfaces no
      // node for them. If a future version does, this case goes red rather than the count doubling
      // silently.
      name: "parenthesised, and still exactly one diagnostic",
      filename: SERVICE,
      code: `export const user = (raw as unknown) as User;`,
      errors: [{ messageId: "chained" }],
    },
    {
      name: "the angle-bracket spelling on both links",
      filename: SERVICE,
      code: `export const user = <User>(<unknown>raw);`,
      errors: [{ messageId: "chained" }],
    },
    {
      name: "mixed spellings, which a rule checking one node type misses",
      filename: SERVICE,
      code: `export const user = <User>(raw as unknown);`,
      errors: [{ messageId: "chained" }],
    },
    {
      // The const link is allowed on its own, so a chain that hides one non-const link behind it
      // must still report — otherwise `as const` becomes the carrier for the real assertion.
      name: "a const link used as cover for a non-const one",
      filename: SERVICE,
      code: `export const user = raw as const as User;`,
      errors: [{ messageId: "chained" }],
    },
    {
      name: "three links are still one finding, not two",
      filename: SERVICE,
      code: `export const user = raw as unknown as Partial<User> as User;`,
      errors: [{ messageId: "chained" }],
    },
    {
      name: "nested inside a call argument rather than a declaration",
      filename: SERVICE,
      code: `export const total = sum(rows as unknown as InvoiceRow[]);`,
      errors: [{ messageId: "chained" }],
    },
    {
      name: "two separate chains in one file are two findings",
      filename: SERVICE,
      code: `export const user = rawUser as unknown as User;
export const invoice = rawInvoice as unknown as Invoice;`,
      errors: [{ messageId: "chained" }, { messageId: "chained" }],
    },
  ],

  legal: [
    {
      name: "a single assertion still has the compiler's overlap check",
      filename: SERVICE,
      code: `export const user = raw as User;`,
    },
    {
      name: "a chain of only const assertions asserts nothing about provenance",
      filename: SERVICE,
      code: `export const statuses = ["draft", "paid"] as const;`,
    },
    {
      // Two assertions in one statement, neither nested in the other. The rule is about stacking,
      // not about counting assertions per line.
      name: "sibling assertions are not a chain",
      filename: SERVICE,
      code: `export const pair = [rawA as AccountId, rawB as InvoiceId];`,
    },
    {
      name: "an assertion wrapping a call whose argument is separately asserted",
      filename: SERVICE,
      code: `export const user = normalise(raw as RawUser) as User;`,
    },
    {
      name: "satisfies is checked and does not stack",
      filename: SERVICE,
      code: `export const handlers = { start: onStart } satisfies Handlers as Handlers;`,
    },
    {
      name: "a test file may stage whatever fixture it needs",
      filename: "/repo/src/features/billing/service/invoices.test.ts",
      code: `const user = {} as unknown as User;`,
    },
    {
      name: "a one-off script is not shipped module graph",
      filename: "/repo/scripts/backfill-invoices.ts",
      code: `const user = raw as unknown as User;`,
    },
  ],
});
