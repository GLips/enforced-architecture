import { describeRule } from "../lib/rule-spec.ts";
import { requireSafetyCommentRule } from "./require-safety-comment.ts";

const SERVICE = "/repo/src/features/billing/service/invoices.ts";
const CONTROLLER = "/repo/src/features/billing/controllers/charge.ts";

describeRule("types/require-safety-comment", requireSafetyCommentRule, {
  obvious: [
    {
      name: "the bare assertion the rule is named for",
      filename: SERVICE,
      code: `export const invoiceId = raw as InvoiceId;`,
      errors: [{ messageId: "missingSafetyComment" }],
    },
    {
      name: "an assertion on a function's return value",
      filename: SERVICE,
      code: `export function loadInvoice(row: InvoiceRow): Invoice { return row as Invoice; }`,
      errors: [{ messageId: "missingSafetyComment" }],
    },
  ],

  adversarial: [
    {
      // The angle-bracket form is a different AST node for the same operation. An agent picks it
      // for style, not to evade — which is exactly why a rule that misses it fails quietly.
      name: "the angle-bracket spelling of the same assertion",
      filename: SERVICE,
      code: `export const invoiceId = <InvoiceId>raw;`,
      errors: [{ messageId: "missingSafetyComment" }],
    },
    {
      name: "buried in a call argument, where there is no line of its own to comment",
      filename: SERVICE,
      code: `export const total = sumAll(rows as InvoiceRow[]);`,
      errors: [{ messageId: "missingSafetyComment" }],
    },
    {
      // The comment sits below the code it claims to justify. Reading order is the whole point of
      // the convention, so a rule that accepts this accepts a justification nobody will see.
      name: "a SAFETY comment written after the assertion instead of before it",
      filename: SERVICE,
      code: `export const invoiceId = raw as InvoiceId;
// SAFETY: parseInvoiceId already validated this.`,
      errors: [{ messageId: "missingSafetyComment" }],
    },
    {
      name: "a comment that says safety without the marker's colon",
      filename: SERVICE,
      code: `// safety is important here
export const invoiceId = raw as InvoiceId;`,
      errors: [{ messageId: "missingSafetyComment" }],
    },
    {
      name: "a SAFETY comment above a different, earlier statement does not reach",
      filename: SERVICE,
      code: `// SAFETY: parseAccountId validated this at the route boundary.
export const accountId = rawAccount as AccountId;
export const invoiceId = rawInvoice as InvoiceId;`,
      errors: [{ messageId: "missingSafetyComment" }],
    },
    {
      name: "inside a ternary branch, which owns no statement of its own",
      filename: CONTROLLER,
      code: `export const id = isDraft ? (raw as DraftId) : fallbackId;`,
      errors: [{ messageId: "missingSafetyComment" }],
    },
    {
      name: "a class property initializer, a comment owner that is not a statement",
      filename: SERVICE,
      code: `export class InvoiceCache { private entries = raw as InvoiceMap; }`,
      errors: [{ messageId: "missingSafetyComment" }],
    },
    {
      name: "two unjustified assertions in one file are two findings, not one",
      filename: SERVICE,
      code: `export const a = rawA as AccountId;
export const b = rawB as InvoiceId;`,
      errors: [{ messageId: "missingSafetyComment" }, { messageId: "missingSafetyComment" }],
    },
    {
      name: "each hop of a widening chain is its own unjustified assertion",
      filename: SERVICE,
      code: `export const invoice = raw as unknown as Invoice;`,
      errors: [{ messageId: "missingSafetyComment" }, { messageId: "missingSafetyComment" }],
    },
  ],

  legal: [
    {
      name: "the justification the message asks for, directly above",
      filename: SERVICE,
      code: `// SAFETY: parseInvoiceId rejected non-branded input at the route boundary.
export const invoiceId = raw as InvoiceId;`,
    },
    {
      name: "the justification above the containing statement, for a nested assertion",
      filename: SERVICE,
      code: `// SAFETY: rows came from selectInvoiceRows, which types every column.
export const total = sumAll(rows as InvoiceRow[]);`,
    },
    {
      name: "a block comment carrying the marker",
      filename: SERVICE,
      code: `/* SAFETY: the discriminant was checked one line above. */
export const paid = invoice as PaidInvoice;`,
    },
    {
      // One comment covering both assertions in a statement is deliberate. Splitting a justified
      // statement in two should not cost two copies of the same sentence.
      name: "one comment covers every assertion in the statement it heads",
      filename: SERVICE,
      code: `// SAFETY: both ids were branded by parseIds before this call.
export const pair = [rawA as AccountId, rawB as InvoiceId];`,
    },
    {
      name: "as const asserts nothing about provenance",
      filename: SERVICE,
      code: `export const STATUSES = ["draft", "paid"] as const;`,
    },
    {
      name: "satisfies is checked by the compiler, so it needs no justification",
      filename: SERVICE,
      code: `export const handlers = { start: onStart } satisfies Record<string, Handler>;`,
    },
    {
      // The bypass, locked in so it stays visible rather than being rediscovered later: one
      // sentence silences BOTH hops of a chain that discards more evidence than either half admits.
      // This is why the header tells adopters to pair this rule with no-chained-type-assertions.
      name: "one comment silences an entire widening chain — the documented bypass",
      filename: SERVICE,
      code: `// SAFETY: the row came from a checked query.
export const invoice = raw as unknown as Invoice;`,
    },
    {
      name: "a test file builds partial fixtures without narrating each one",
      filename: "/repo/src/features/billing/service/invoices.test.ts",
      code: `const fixture = { id: "inv_1" } as Invoice;`,
    },
    {
      name: "a one-off script is not shipped module graph",
      filename: "/repo/scripts/backfill-invoices.ts",
      code: `const row = raw as InvoiceRow;`,
    },
  ],
});
