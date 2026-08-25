import { describeRule } from "../lib/rule-spec.ts";
import { noLongCommentsRule } from "./no-long-comments.ts";

const SERVICE = "/repo/src/features/billing/service/invoices.ts";
const UI = "/repo/src/features/billing/ui/invoice-row.tsx";

// Two paragraphs of 41 words each. Almost every case below is built from them, so the cases differ
// only in how the same prose is SPELLED — the one thing this rule must not care about. Each
// paragraph alone is under the 60-word ceiling; the pair is over it and under the header's 120.
const FIRST = `The invoice total is recomputed here rather than read from the row, because rows
written before tax rates were versioned carry a total that no longer matches their line items, and
both earlier attempts to patch it in the reader drifted.`;
const SECOND = `Reading the line items is slower, and it is the only number anybody can defend in
front of a customer, so it is the one this function hands back to every caller regardless of what
the stored column happens to say.`;

const asLineComments = (text: string) =>
  text
    .split("\n")
    .map((line) => `// ${line}`)
    .join("\n");

// Every violating case needs a statement above it, or the run is the file's header and gets twice
// the room. That is not fixture ceremony — it is the allowance being real, and the legal list holds
// the same prose in header position to say so from the other side.
const ABOVE = `export const CURRENCY = "usd";`;

describeRule("health/no-long-comments", noLongCommentsRule, {
  obvious: [
    {
      name: "one block comment past the word ceiling",
      filename: SERVICE,
      code: `${ABOVE}
/*
${FIRST}

${SECOND}
*/
export function invoiceTotal(): number { return 0; }`,
      errors: [{ messageId: "tooManyWords" }],
    },
    {
      name: "the same essay as a JSDoc block, which is prose wearing a doc comment",
      filename: SERVICE,
      code: `${ABOVE}
/**
 * ${FIRST}
 *
 * ${SECOND}
 */
export function invoiceTotal(): number { return 0; }`,
      errors: [{ messageId: "tooManyWords" }],
    },
  ],

  adversarial: [
    {
      // The bypass a per-comment rule hands out for free: the block becomes N line comments and
      // every single one of them is short. Only the run measures what the reader actually reads.
      name: "the block respelled as line comments, each one short",
      filename: SERVICE,
      code: `${ABOVE}
${asLineComments(FIRST)}
${asLineComments(SECOND)}
export function invoiceTotal(): number { return 0; }`,
      errors: [{ messageId: "tooManyWords" }],
    },
    {
      // Pressing Enter. Each paragraph is 41 words and legal on its own — the first of them is in
      // the legal list, unchanged — and nothing but a blank line joins them here.
      name: "two legal paragraphs with a blank line between them",
      filename: SERVICE,
      code: `${ABOVE}
${asLineComments(FIRST)}

${asLineComments(SECOND)}
export function invoiceTotal(): number { return 0; }`,
      errors: [{ messageId: "tooManyWords" }],
    },
    {
      name: "one paragraph as a block and the next as line comments, mixed in one run",
      filename: SERVICE,
      code: `${ABOVE}
/* ${FIRST} */
${asLineComments(SECOND)}
export function invoiceTotal(): number { return 0; }`,
      errors: [{ messageId: "tooManyWords" }],
    },
    {
      // A trailing comment sits after code and is still a comment somebody has to read. A rule that
      // only visited comments starting a line would let the whole essay move one column right.
      name: "an essay trailing a statement on its own line",
      filename: SERVICE,
      code: `export const total = 0; // ${FIRST.replace(/\n/gu, " ")} ${SECOND.replace(/\n/gu, " ")}`,
      errors: [{ messageId: "tooManyWords" }],
    },
    {
      // In `.tsx` the braces around each comment are the idiom, not evasion — so a run split on
      // them would leave the ceiling unable to bind anywhere a component keeps its prose, which is
      // where prose collects. Eight comments, ~90 words, and nothing between them a reviewer sees.
      name: "a stack of braced JSX comments, which plain whitespace would read as eight comments",
      filename: UI,
      code: `export function InvoiceRow() {
  return (
    <div>
      {/* The invoice total is recomputed here rather than read from the row, because rows */}
      {/* written before tax rates were versioned carry a total that no longer matches */}
      {/* their line items, and both earlier attempts to patch it in the reader drifted. */}
      {/* Reading the line items is slower, and it is the only number anybody can defend */}
      {/* in front of a customer, so it is the one this function hands back to every */}
      {/* caller regardless of what the stored column happens to say. */}
    </div>
  );
}`,
      errors: [{ messageId: "tooManyWords" }],
    },
    {
      // Over BOTH ceilings, which is the case that pins the precedence and the single report. Ask
      // the line ceiling first and this says `tooManyLines`; drop the `continue` and it says both.
      // Every other case here trips exactly one threshold and sees neither mutation.
      name: "prose over both ceilings is one finding, and it is the word one",
      filename: SERVICE,
      code: `${ABOVE}
// The invoice total is
// recomputed here rather
// than read from the row,
// because rows written
// before tax rates were
// versioned carry a total
// that no longer matches
// their line items, and
// both earlier attempts
// to patch it in the
// reader drifted. The
// line items are slower
// to read and the only
// number anybody can
// defend in front of a
// customer, so they are
// what this hands back.
export function invoiceTotal(): number { return 0; }`,
      errors: [{ messageId: "tooManyWords" }],
    },
    {
      // Under `[\\p{L}]` alone this is 40 words and legal. Version strings, dates and row counts are
      // what a reader has to hold as much as prose is, and a comment can be padded with them.
      name: "digits are words, so a table of numbers is not free",
      filename: SERVICE,
      code: `${ABOVE}
// Tax rate revisions this reader has to know about, by release and by the
// rate each one shipped: 2019 7 2020 7 2021 8 2022 8 2023 9 2024 9 2025 10
// 2026 10 2027 11 2028 11 2029 12 2030 12 and the two backfills at 4471 and
// 9302 rows respectively, both of which rewrote totals in place rather than
// versioning them.
export function invoiceTotal(): number { return 0; }`,
      errors: [{ messageId: "tooManyWords" }],
    },
    {
      // Under the word ceiling and still a screenful. This is the case the word count alone
      // cannot see, and the only thing the line ceiling is for.
      name: "a banner that beats the word count by having almost no words",
      filename: SERVICE,
      code: `${ABOVE}
// ══════════════════════════════════
// ║                                ║
// ║        INVOICE  SERVICE        ║
// ║                                ║
// ══════════════════════════════════
//
//   ┌──────────────┐
//   │              │
//   │    totals    │
//   │              │
//   └──────────────┘
//
// ══════════════════════════════════
// ║                                ║
// ║        end  of  banner         ║
// ║                                ║
// ══════════════════════════════════
export const total = 0;`,
      errors: [{ messageId: "tooManyLines" }],
    },
    {
      // The header's extra room is a multiple, so a project can set it to 1 and have the file header
      // measured like anything else. The legal list holds this exact prose passing at the default.
      name: "the file header at headerMultiple 1, where the allowance is switched off",
      filename: SERVICE,
      code: `${asLineComments(FIRST)}
${asLineComments(SECOND)}
export function invoiceTotal(): number { return 0; }`,
      options: [{ headerMultiple: 1 }],
      errors: [{ messageId: "tooManyWords" }],
    },
    {
      // Doubled is not unbounded. Three paragraphs is 123 words, and the header ceiling is 120.
      name: "a file header past the doubled ceiling",
      filename: SERVICE,
      code: `${asLineComments(FIRST)}
${asLineComments(SECOND)}
${asLineComments(FIRST)}
export function invoiceTotal(): number { return 0; }`,
      errors: [{ messageId: "tooManyWords" }],
    },
    {
      // The knob is a number, and a project that sets a tighter one gets a tighter rule. Proving it
      // here rather than only in `legal` means a `maxWords` that is read but never compared fails.
      name: "a short comment under a lowered word ceiling",
      filename: SERVICE,
      code: `${ABOVE}
// The row's total predates versioned tax rates and no longer matches its line items.
export const total = 0;`,
      options: [{ maxWords: 5 }],
      errors: [{ messageId: "tooManyWords" }],
    },
    {
      name: "a four-line comment under a lowered line ceiling",
      filename: SERVICE,
      code: `${ABOVE}
// draft
// open
// paid
// closed
export const total = 0;`,
      options: [{ maxLines: 3 }],
      errors: [{ messageId: "tooManyLines" }],
    },
  ],

  legal: [
    {
      // The other half of the two adversarial header cases: 82 words, over the ordinary ceiling and
      // under the doubled one. The same prose one statement lower is the first adversarial case, so
      // the pair pins the allowance from both sides — delete it and this reports.
      name: "a file header using the room a file header gets",
      filename: SERVICE,
      code: `${asLineComments(FIRST)}
${asLineComments(SECOND)}
export function invoiceTotal(): number { return 0; }`,
    },
    {
      // The header question is asked of the program body, not of the offset, so a shebang above the
      // header does not cost it the allowance — a file with one is the same file.
      name: "a shebang above the header does not cost it the allowance",
      filename: SERVICE,
      code: `#!/usr/bin/env node
${asLineComments(FIRST)}
${asLineComments(SECOND)}
export function invoiceTotal(): number { return 0; }`,
    },
    {
      // 41 words: the first paragraph of every violation above, on its own. The rule leaves room
      // for the comment worth writing — why this shape, and what the code cannot say.
      name: "one paragraph of rationale",
      filename: SERVICE,
      code: `${ABOVE}
${asLineComments(FIRST)}
export function invoiceTotal(): number { return 0; }`,
    },
    {
      // Code ends a run. Two rationales for two statements are two comments, not one essay, and a
      // rule that merged across code would report the pair the moment a file explained itself twice.
      name: "two paragraphs with the code they explain between them",
      filename: SERVICE,
      code: `${ABOVE}
${asLineComments(FIRST)}
export function invoiceTotal(): number { return 0; }
${asLineComments(SECOND)}
export function invoiceTax(): number { return 0; }`,
    },
    {
      // The brace join is closing-then-opening and nothing else. An element between two braced
      // comments is code, so these stay two runs — a join that swallowed any punctuation would
      // merge every comment in a component and report the file rather than the essay.
      name: "braced JSX comments with an element between them are separate runs",
      filename: UI,
      code: `export function InvoiceRow() {
  return (
    <div>
      {/* ${FIRST.replace(/\n/gu, " ")} */}
      <span />
      {/* ${SECOND.replace(/\n/gu, " ")} */}
    </div>
  );
}`,
    },
    {
      // The same shape outside JSX, and the reason the join is closing-THEN-opening rather than any
      // run of braces: nothing but `}` sits between these two, so a wider test merges the note
      // inside the function with the note above the next declaration and reports the pair.
      name: "a closing brace between two comments does not join them",
      filename: SERVICE,
      code: `export function recordTotal(): void {
  ${asLineComments(FIRST)}
}
${asLineComments(SECOND)}
export function invoiceTax(): number { return 0; }`,
    },
    {
      // A shebang is a line for the host, not prose. With the allowance off and a two-line ceiling,
      // one that counted as part of the run makes this three lines and reports.
      name: "a shebang is not measured as part of the header it sits above",
      filename: SERVICE,
      code: `#!/usr/bin/env node
// Totals come from the line items,
// never from the stored column.
export const total = 0;`,
      options: [{ maxLines: 2, headerMultiple: 1 }],
    },
    {
      // Thirteen lines, and almost all of it punctuation. A diagram is the long comment that
      // carries what prose cannot, so the line ceiling has to sit above one and below the banner.
      name: "a state table drawn just under the line ceiling",
      filename: SERVICE,
      code: `${ABOVE}
// ┌────────┬────────┐
// │ state  │ next   │
// ├────────┼────────┤
// │ draft  │ open   │
// │ open   │ paid   │
// │ paid   │ closed │
// │ closed │ —      │
// └────────┴────────┘
//
// ┌────────┬────────┐
// │ void   │ —      │
// │ refund │ closed │
// └────────┴────────┘
export const total = 0;`,
    },
    {
      // Sixty words of prose and ten asterisks, which is the whole case for counting only tokens
      // that hold a letter or a digit. Charge for the gutter and this reads as seventy and reports,
      // and the edit the report asks for is to unwrap the comment — the shape the rule wants.
      name: "a JSDoc block whose asterisk gutter would push it over if asterisks were words",
      filename: SERVICE,
      code: `${ABOVE}
/**
 * Recomputed rather than read from the row.
 * Rows written before tax rates were versioned
 * carry a total that no longer matches their
 * line items, and the two earlier attempts to
 * patch that in the reader both drifted within
 * a release. The line items are the only
 * number anybody can defend to a customer,
 * so they are what this hands back.
 */
export function invoiceTotal(): number { return 0; }`,
    },
    {
      name: "a boxed section header of the size a reader actually skims",
      filename: SERVICE,
      code: `// ─── totals ───────────────────────
export const total = 0;`,
    },
    {
      // The line count sums the lines the comments OCCUPY, not the span from the first to the last.
      // Measured as a span this run is five lines and reports, which would mean a rule a paragraph
      // break can trip — and the edit it would ask for is to delete the blank line.
      name: "blank lines between paragraphs do not count toward the line ceiling",
      filename: SERVICE,
      code: `${ABOVE}
// Totals come from the line items.


// Never from the stored column.
export const total = 0;`,
      options: [{ maxLines: 3 }],
    },
    {
      // The threshold is the adaptation. A project that wants more room raises it in one visible
      // place, rather than exempting the file that grew.
      name: "the essay under a raised word ceiling",
      filename: SERVICE,
      code: `${ABOVE}
${asLineComments(FIRST)}
${asLineComments(SECOND)}
export function invoiceTotal(): number { return 0; }`,
      options: [{ maxWords: 200 }],
    },
    {
      name: "a test file writes as much prose about its fixtures as it likes",
      filename: "/repo/src/features/billing/service/invoices.test.ts",
      code: `${ABOVE}
${asLineComments(FIRST)}
${asLineComments(SECOND)}
export const fixture = 0;`,
    },
    {
      name: "a one-off script is not shipped module graph",
      filename: "/repo/scripts/backfill-invoices.ts",
      code: `${ABOVE}
${asLineComments(FIRST)}
${asLineComments(SECOND)}
export const total = 0;`,
    },
  ],
});
