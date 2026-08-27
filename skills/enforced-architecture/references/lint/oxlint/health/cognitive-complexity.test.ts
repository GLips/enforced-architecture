import { describeRule } from "../lib/rule-spec.ts";
import { cognitiveComplexityRule } from "./cognitive-complexity.ts";

const SERVICE = "/repo/src/features/billing/service/invoices.ts";

// One body, used by the obvious case and by two adversarial ones. It scores 23 against the default
// threshold of 20 wherever it is written, and the whole claim of the two rollup adjustments is that
// moving it does not change the number: a reader reads the same lines either way.
//
// Written out rather than built from a helper, because the SPELLING is the variable under test and
// a helper that generated it would hide the one thing each case is about.
const NESTED_BODY = `for (const line of invoice.lines) {
    if (line.taxable) {
      if (line.region === "eu") {
        if (line.reduced) { record(line, 1.05); } else { record(line, 1.2); }
      } else if (line.region === "us") {
        for (const rate of line.rates) { if (rate.active) { record(line, rate.value); } }
      } else {
        record(line, 1);
      }
    } else if (line.credit) {
      record(line, -1);
    }
  }`;

describeRule("health/cognitive-complexity", cognitiveComplexityRule, {
  obvious: [
    {
      name: "branches nested four deep inside a loop",
      filename: SERVICE,
      code: `export function priceInvoice(invoice: Invoice): void {
  ${NESTED_BODY}
}`,
      errors: [{ messageId: "tooComplex" }],
    },
  ],

  adversarial: [
    {
      // Adjustments 1 and 3 together, and the case that decides whether this rule is worth having
      // over a per-function scorer. `priceInvoice` above and this are the same lines to read; a rule
      // that scored each function separately sees a two-line `recordInvoice` and reports nothing,
      // and a rule that charged the callback boundary as nesting reports a much larger number for
      // code that got no harder. The score here is the same 23.
      name: "the same body inside an anonymous transaction callback",
      filename: SERVICE,
      code: `export function recordInvoice(db: Db, invoice: Invoice): void {
  db.transaction(() => {
    ${NESTED_BODY}
  });
}`,
      errors: [{ messageId: "tooComplex" }],
    },
    {
      // Nothing here has a name. A subject list built from named functions alone measures this file
      // with nothing at all, and the silence reads exactly like a simple module.
      name: "the whole module's work in an anonymous default export",
      filename: SERVICE,
      code: `export default (invoice: Invoice) => {
  ${NESTED_BODY}
};`,
      errors: [{ messageId: "tooComplex" }],
    },
    {
      // The negative space in the rule's header, asserted from the positive side: adjustment 2 makes
      // a guard chain CHEAPER, never free. Twenty guards inside a loop is a function nothing in a
      // control-flow metric can see through — the branches are uniform and the metric has no notion
      // of uniformity — so the rule reports it and the header says why.
      name: "a long chain of uniform guard clauses inside a loop still reports",
      filename: SERVICE,
      code: `export function collectPayable(rows: Row[]): Row[] {
  const out: Row[] = [];
  for (const row of rows) {
    if (row.void) continue;
    if (row.draft) continue;
    if (row.refunded) continue;
    if (row.zero) continue;
    if (row.internal) continue;
    if (row.test) continue;
    if (row.archived) continue;
    if (row.disputed) continue;
    if (row.pending) continue;
    if (row.locked) continue;
    if (row.deleted) continue;
    if (row.hidden) continue;
    if (row.stale) continue;
    if (row.duplicate) continue;
    if (row.partial) continue;
    if (row.foreign) continue;
    if (row.manual) continue;
    if (row.legacy) continue;
    if (row.synthetic) continue;
    out.push(row);
  }
  return out;
}`,
      errors: [{ messageId: "tooComplex" }],
    },
    {
      // `if (x) return; else { … }` is a fork, not an exit: both sides are live after it and the
      // else side is where the work is. Treat it as a guard and the else branch is charged nothing
      // at all — this function scores 22 as shipped and 2 with the `else` test lifted, which is a
      // rule that a single `else` keyword switches off.
      name: "an early return with an else branch is a fork, not a guard",
      filename: SERVICE,
      code: `export function classify(row: Row, opts: Options): number {
  if (row.void) return 0;
  else {
    if (opts.trace) { for (const part of row.parts) { if (part.ok) { record(part); } } }
  }
  if (row.draft) return 1;
  else {
    if (opts.audit) { for (const part of row.parts) { if (part.ok) { record(part); } } }
  }
  return 9;
}`,
      // 21, not the default, because this case pins the BARE ELSE charge as well: 22 as shipped,
      // 20 with `else` costing nothing. Two mechanisms, one fixture, and each of the two reverts
      // drops the score past this line on its own.
      options: [{ threshold: 21 }],
      errors: [{ messageId: "tooComplex" }],
    },
    {
      // A labelled jump leaves the loop the reader is in for one named somewhere above — the reader
      // has to go and find it, which a bare `break` never asks. Two of them here take 5 to 7.
      name: "a labelled break and continue crossing two loops",
      filename: SERVICE,
      code: `export function firstShared(rows: Row[], others: Row[]): Row | null {
  let found: Row | null = null;
  outer: for (const row of rows) {
    for (const other of others) {
      if (row.id === other.id) { found = row; break outer; }
      if (row.ref === other.ref) { found = other; continue outer; }
    }
  }
  return found;
}`,
      options: [{ threshold: 7 }],
      errors: [{ messageId: "tooComplex" }],
    },
    {
      // The escape adjustment 2 would otherwise hand out: end any block with `return` and the whole
      // block is an exit, costing +1 and nesting nothing. Three branches doing real work before
      // leaving score 30; lift the two-statement ceiling and the same code scores 21. That is why a
      // guard is a jump with at most one line in front of it, and not merely a block that ends in one.
      name: "branches doing real work before returning are not guard clauses",
      filename: SERVICE,
      code: `export function settle(rows: Row[], opts: Options): number {
  if (opts.dry) {
    const stamp = clock.now();
    if (opts.trace) { for (const r of rows) { if (r.ok) { record(r, stamp); } } }
    return 0;
  }
  if (opts.audit) {
    const stamp = clock.now();
    if (opts.trace) { for (const r of rows) { if (r.ok) { record(r, stamp); } } }
    return 1;
  }
  if (opts.deep) {
    const stamp = clock.now();
    if (opts.trace) { for (const r of rows) { if (r.ok) { record(r, stamp); } } }
    return 2;
  }
  return 3;
}`,
      options: [{ threshold: 24 }],
      errors: [{ messageId: "tooComplex" }],
    },
    {
      // A switch is one increment however many arms it has — the legal case below is the whole
      // point of that — but the SWITCH is still a level, and its arms nest what they hold. Four
      // switches inside a switch inside a loop scores 15 on the charge and 1 without it, which is
      // the only shape that can tell those two apart: a flat switch scores 1 either way.
      name: "switches nested inside a switch inside a loop",
      filename: SERVICE,
      code: `export function routeRows(rows: Row[]): number[] {
  const out: number[] = [];
  for (const row of rows) {
    switch (row.kind) {
      case "a":
        switch (row.sub) {
          case "x": out.push(1); break;
          case "y": out.push(2); break;
          default: out.push(0);
        }
        break;
      case "b":
        switch (row.sub) {
          case "x": out.push(3); break;
          case "y": out.push(4); break;
          default: out.push(0);
        }
        break;
      case "c":
        switch (row.sub) {
          case "x": out.push(5); break;
          case "y": out.push(6); break;
          default: out.push(0);
        }
        break;
      default:
        switch (row.sub) {
          case "x": out.push(7); break;
          case "y": out.push(8); break;
          default: out.push(0);
        }
    }
  }
  return out;
}`,
      options: [{ threshold: 14 }],
      errors: [{ messageId: "tooComplex" }],
    },
    {
      // The knob is a number, and proving it here rather than only in `legal` means a `threshold`
      // that is read but never compared fails. This body scores 2: the guard, and the ternary.
      name: "a shallow function under a lowered threshold",
      filename: SERVICE,
      code: `export function taxRate(line: Line): number {
  if (line.region === "eu") { return line.reduced ? 1.05 : 1.2; }
  return 1;
}`,
      options: [{ threshold: 2 }],
      errors: [{ messageId: "tooComplex" }],
    },
  ],

  legal: [
    {
      // Cyclomatic 13, cognitive 1. This is the whole reason the catalog measures cognitive
      // complexity rather than counting decision points: twelve cases is one thing to understand.
      name: "a flat twelve-case switch",
      filename: SERVICE,
      code: `export function invoiceRank(kind: string): number {
  switch (kind) {
    case "a": return 1;
    case "b": return 2;
    case "c": return 3;
    case "d": return 4;
    case "e": return 5;
    case "f": return 6;
    case "g": return 7;
    case "h": return 8;
    case "i": return 9;
    case "j": return 10;
    case "k": return 11;
    default: return 0;
  }
}`,
    },
    {
      // `else if` is a list the eye reads down, not a stack, so a chain costs +1 an arm and opens no
      // level. INSIDE A LOOP is the only place that claim can be tested: at the top level the arms
      // sit at nesting zero and charging them as nesting gives the same answer, so a chain written
      // there proves nothing. Here the chain scores 11, and 18 if the arms are charged as nesting —
      // over the 14 set below.
      name: "an eight-arm else-if chain inside a loop",
      filename: SERVICE,
      code: `export function labelRows(rows: Row[]): string[] {
  const out: string[] = [];
  for (const row of rows) {
    if (row.status === "a") out.push("A");
    else if (row.status === "b") out.push("B");
    else if (row.status === "c") out.push("C");
    else if (row.status === "d") out.push("D");
    else if (row.status === "e") out.push("E");
    else if (row.status === "f") out.push("F");
    else if (row.status === "g") out.push("G");
    else if (row.status === "h") out.push("H");
    else out.push("?");
  }
  return out;
}`,
      options: [{ threshold: 14 }],
    },
    {
      // A run of one operator is one thing to check, however long: `a && b && c && d && e` is +1,
      // and changing operator mid-chain is what costs. Six guards with a five-term chain each score
      // 12; charge every `&&` and the same function scores 30 and reports. Without this a rule
      // asks for conditions to be split into more `if`s, which is the shape it also reports.
      name: "six guard clauses, each with a five-term boolean chain",
      filename: SERVICE,
      code: `export function eligible(row: Row, opts: Options): boolean {
  if (!row.id && !row.ref && !row.slug && !row.key && !row.tag) return false;
  if (row.void && row.draft && row.stale && row.hidden && row.locked) return false;
  if (!opts.strict && !opts.audit && !opts.dry && !opts.trace && !opts.deep) return false;
  if (row.a && row.b && row.c && row.d && row.e) return false;
  if (!row.f && !row.g && !row.h && !row.i && !row.j) return false;
  if (row.k && row.l && row.m && row.n && row.o) return false;
  return true;
}`,
    },
    {
      // Adjustment 3, and it is the edit the rule's own message asks for. Three scores here — 3 for
      // the function, 9 and 8 for the helpers — and not one of them is near the threshold. Fold
      // named helpers into their parent the way stock cognitive complexity does and the function
      // scores 20 and reports, which would be a rule flagging the refactor it just asked for.
      //
      // The margins are deliberately tight on both sides: a helper at 9 proves the split is real
      // rather than merely small, and a rolled-up 20 lands exactly on the default threshold.
      name: "the same work behind two named helpers",
      filename: SERVICE,
      code: `export function priceViaHelpers(invoice: Invoice): number {
  const euRate = (line: Line) => {
    if (line.band === "a") return 1.05;
    else if (line.band === "b") return 1.1;
    else if (line.band === "c") return 1.15;
    else if (line.band === "d") return 1.2;
    else if (line.band === "e") return 1.25;
    else if (line.band === "f") return 1.3;
    else if (line.band === "g") return 1.35;
    else if (line.band === "h") return 1.4;
    else return 1;
  };
  const usRate = (line: Line) => {
    let rate = 1;
    for (const entry of line.rates) {
      if (entry.active) {
        if (entry.local) { rate = entry.value; } else { rate = entry.value * 0.5; }
      } else if (entry.pending) {
        rate = 1;
      }
    }
    return rate;
  };
  let total = 0;
  for (const line of invoice.lines) {
    total += line.amount * (line.region === "eu" ? euRate(line) : usRate(line));
  }
  return total;
}`,
    },
    {
      // Adjustment 2, pinned by the threshold rather than only allowed by the default. Eight guards
      // inside a loop score 9. Charge each one the nesting penalty of the `if` it is not and the
      // same eight score 17, which is over the 12 set here — so deleting the adjustment fails this
      // case rather than quietly widening the rule.
      name: "eight guard clauses inside a loop, under a threshold the nesting penalty would break",
      filename: SERVICE,
      code: `export function payableRows(rows: Row[]): Row[] {
  const out: Row[] = [];
  for (const row of rows) {
    if (row.void) continue;
    if (row.draft) continue;
    if (row.refunded) continue;
    if (row.zero) continue;
    if (row.internal) continue;
    if (row.archived) continue;
    if (row.disputed) continue;
    if (row.duplicate) continue;
    out.push(row);
  }
  return out;
}`,
      options: [{ threshold: 12 }],
    },
    {
      // Adjustment 1, pinned the same way. Two callbacks and two real branches score 3. Charge each
      // function boundary a nesting level and the same code scores 7, over the 5 set here — so this
      // case is what stands between the adjustment and a rule that punishes composition.
      name: "branches inside two nested callbacks, under a threshold the boundary penalty would break",
      filename: SERVICE,
      code: `export function syncInvoices(queue: Queue, invoices: Invoice[]): void {
  queue.run(() => {
    invoices.forEach((invoice) => {
      if (invoice.dirty) {
        if (invoice.remote) { queue.push(invoice); }
      }
    });
  });
}`,
      options: [{ threshold: 5 }],
    },
    {
      // The threshold is the adaptation. A project whose domain is genuinely this shape raises it in
      // one visible place, rather than exempting the function that grew.
      name: "the nested body under a raised threshold",
      filename: SERVICE,
      code: `export function priceInvoice(invoice: Invoice): void {
  ${NESTED_BODY}
}`,
      options: [{ threshold: 40 }],
    },
    {
      // A table-driven test is a long flat list of cases, and its setup is not architecture.
      name: "a test file is not a subject",
      filename: "/repo/src/features/billing/service/invoices.test.ts",
      code: `export function priceInvoice(invoice: Invoice): void {
  ${NESTED_BODY}
}`,
    },
    {
      name: "a one-off script is not shipped module graph",
      filename: "/repo/scripts/backfill-invoices.ts",
      code: `export function priceInvoice(invoice: Invoice): void {
  ${NESTED_BODY}
}`,
    },
  ],
});
