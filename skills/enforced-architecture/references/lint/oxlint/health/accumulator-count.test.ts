import { describeRule } from "../lib/rule-spec.ts";
import { accumulatorCountRule } from "./accumulator-count.ts";

const SERVICE = "/repo/src/features/billing/service/invoices.ts";

describeRule("health/accumulator-count", accumulatorCountRule, {
  obvious: [
    {
      // Five values in flight: `total`, `skipped`, `errors`, `seen`, `latest`. Nesting is two and
      // every branch is plain — a control-flow metric has almost nothing to say about this function,
      // and it still cannot be read a piece at a time.
      name: "five values built at once across the branches of one loop",
      filename: SERVICE,
      code: `export function reconcile(rows: Row[], opts: Options): Summary {
  let total = 0;
  let skipped = 0;
  const errors: string[] = [];
  const seen = new Set<string>();
  let latest: Row | null = null;
  for (const row of rows) {
    if (row.void) { skipped = skipped + 1; continue; }
    if (seen.has(row.id)) { errors.push(row.id); skipped += 1; continue; }
    seen.add(row.id);
    total += row.amount;
    if (row.at > (latest?.at ?? 0)) { latest = row; } else { latest = null; seen.delete(row.id); }
  }
  if (opts.strict) { errors.push("strict"); total = 0; }
  return { total, skipped, errors, seen, latest };
}`,
      errors: [{ messageId: "tooMuchState" }],
    },
  ],

  adversarial: [
    {
      // The same five accumulators, written from inside callbacks. A walk that stopped at every
      // function boundary — which is what "measure one function" usually means — sees five bindings
      // and no writes at all, and reports nothing. The reader's burden is identical.
      name: "the same five, written from inside anonymous callbacks",
      filename: SERVICE,
      code: `export function reconcileFunctional(rows: Row[], opts: Options): Summary {
  let total = 0;
  let skipped = 0;
  const errors: string[] = [];
  const seen = new Set<string>();
  let latest: Row | null = null;
  rows.forEach((row) => {
    if (row.void) { skipped = skipped + 1; return; }
    seen.add(row.id);
    total += row.amount;
    latest = row;
  });
  rows.forEach((row) => { errors.push(row.id); });
  if (opts.strict) {
    errors.push("strict");
    total = 0;
    skipped = 0;
    latest = null;
    seen.add("x");
  }
  return { total, skipped, errors, seen, latest };
}`,
      errors: [{ messageId: "tooMuchState" }],
    },
    {
      // `const totals = {} as Record<string, number>` is how an empty accumulator is ordinarily
      // spelled in TypeScript. Read the initializer without going through the cast and every one of
      // these disappears from the count — an annotation that silently switches the rule off, reached
      // for by an author who was only satisfying the type checker.
      name: "accumulators declared through a type assertion",
      filename: SERVICE,
      code: `export function buildReport(rows: Row[]): Report {
  const byId = new Map<string, Row>() as Map<string, Row>;
  const totals = {} as Record<string, number>;
  const flags = [] as string[];
  const tags = new Set<string>() as Set<string>;
  for (const row of rows) {
    if (row.ok) {
      byId.set(row.id, row);
      totals[row.id] = row.amount;
      flags.push("ok");
      tags.add(row.tag);
    } else {
      byId.delete(row.id);
      totals[row.id] = 0;
      flags.pop();
      tags.delete(row.tag);
    }
  }
  return { byId, totals, flags, tags };
}`,
      errors: [{ messageId: "tooMuchState" }],
    },
    {
      // No mutating method anywhere: every write is an assignment into a field or an index. A rule
      // that only knew `push`/`set`/`add` sees a function building nothing.
      name: "four accumulators written only through field and index assignment",
      filename: SERVICE,
      code: `export function tally(rows: Row[]): Tally {
  const totals: Record<string, number> = {};
  const names: Record<string, string> = {};
  const flags: boolean[] = [];
  const at: number[] = [];
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    if (row.ok) {
      totals[row.id] = row.amount;
      names[row.id] = row.name;
      flags[index] = true;
      at[index] = row.at;
    } else {
      totals[row.id] = 0;
      names[row.id] = "";
      flags[index] = false;
      at[index] = 0;
    }
  }
  return { totals, names, flags, at };
}`,
      errors: [{ messageId: "tooMuchState" }],
    },
    {
      // The knob is a number, and proving it here rather than only in `legal` means a `threshold`
      // that is read but never compared fails.
      name: "two accumulators under a lowered threshold",
      filename: SERVICE,
      code: `export function countRows(rows: Row[]): Counts {
  let ok = 0;
  let bad = 0;
  for (const row of rows) {
    if (row.ok) { ok += 1; bad -= 1; } else { bad += 1; ok -= 1; }
  }
  return { ok, bad };
}`,
      options: [{ threshold: 2 }],
      errors: [{ messageId: "tooMuchState" }],
    },
  ],

  legal: [
    {
      // Five collections, each written in exactly ONE place. This is the shape a rule that counted
      // every mutable binding would report, and it is a function anybody reads top to bottom: one
      // pass, one story, nothing to hold. The second write site is what this rule is about.
      name: "five collections filled by one pass each",
      filename: SERVICE,
      code: `export function summarise(rows: Row[]): Summary {
  const ids: string[] = [];
  const names: string[] = [];
  const totals: number[] = [];
  let count = 0;
  const seen = new Set<string>();
  for (const row of rows) {
    ids.push(row.id);
    names.push(row.name);
    totals.push(row.amount);
    count = count + 1;
    seen.add(row.id);
  }
  return { ids, names, totals, count, seen };
}`,
    },
    {
      // The edit the rule's message asks for, and the rule must be silent on its own answer. Five
      // accumulators, one per named helper, each with two write sites. Roll named functions into
      // their parent and this reports five — a rule that flags the refactor it just demanded.
      name: "five accumulators, one to each named helper",
      filename: SERVICE,
      code: `export function reconcileSplit(rows: Row[]): Summary {
  const totalOf = (rs: Row[]) => {
    let t = 0;
    for (const r of rs) { if (r.ok) { t += r.amount; } else { t -= r.amount; } }
    return t;
  };
  const idsOf = (rs: Row[]) => {
    const out: string[] = [];
    for (const r of rs) { if (r.ok) { out.push(r.id); } else { out.push("-"); } }
    return out;
  };
  const seenOf = (rs: Row[]) => {
    const s = new Set<string>();
    for (const r of rs) { if (r.ok) { s.add(r.id); } else { s.delete(r.id); } }
    return s;
  };
  const skippedOf = (rs: Row[]) => {
    let n = 0;
    for (const r of rs) { if (r.void) { n += 1; } else { n -= 1; } }
    return n;
  };
  const errorsOf = (rs: Row[]) => {
    const e: string[] = [];
    for (const r of rs) { if (r.bad) { e.push(r.id); } else { e.pop(); } }
    return e;
  };
  return {
    total: totalOf(rows),
    ids: idsOf(rows),
    seen: seenOf(rows),
    skipped: skippedOf(rows),
    errors: errorsOf(rows),
  };
}`,
    },
    {
      // Parameters are facts the function was handed, not facts it is building, so normalising four
      // of them in place is not four things to hold. A rule that counted every name it saw written
      // reports this, and it is one of the commonest shapes in a codebase.
      name: "four parameters normalised in place",
      filename: SERVICE,
      code: `export function normalise(a: Input, b: Input, c: Input, d: Input): Normalised {
  a = a ?? EMPTY;
  b = b ?? EMPTY;
  c = c ?? EMPTY;
  d = d ?? EMPTY;
  a = a.value;
  b = b.value;
  c = c.value;
  d = d.value;
  return { a, b, c, d };
}`,
    },
    {
      // Four `const` bindings that never change: reading widely is not holding state. The count is
      // about what moves under the reader, and nothing here does.
      name: "four values read once and returned",
      filename: SERVICE,
      code: `export function describeInvoice(invoice: Invoice): Description {
  const total = invoice.lines.reduce((sum, line) => sum + line.amount, 0);
  const count = invoice.lines.length;
  const currency = invoice.currency ?? "usd";
  const issued = invoice.issuedAt ?? invoice.createdAt;
  return { total, count, currency, issued };
}`,
    },
    {
      // The threshold is the adaptation. A parser or a scheduler that genuinely coordinates this
      // many values raises it in one visible place, rather than exempting the function that grew.
      name: "five accumulators under a raised threshold",
      filename: SERVICE,
      code: `export function reconcile(rows: Row[], opts: Options): Summary {
  let total = 0;
  let skipped = 0;
  const errors: string[] = [];
  const seen = new Set<string>();
  let latest: Row | null = null;
  for (const row of rows) {
    if (row.void) { skipped = skipped + 1; continue; }
    if (seen.has(row.id)) { errors.push(row.id); skipped += 1; continue; }
    seen.add(row.id);
    total += row.amount;
    if (row.at > (latest?.at ?? 0)) { latest = row; } else { latest = null; seen.delete(row.id); }
  }
  if (opts.strict) { errors.push("strict"); total = 0; }
  return { total, skipped, errors, seen, latest };
}`,
      options: [{ threshold: 6 }],
    },
    {
      // A test builds fixtures, and a builder holding several is a fixture, not an architecture.
      name: "a test file is not a subject",
      filename: "/repo/src/features/billing/service/invoices.test.ts",
      code: `export function fixture(rows: Row[]): Summary {
  let total = 0;
  let skipped = 0;
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (row.void) { skipped += 1; errors.push(row.id); continue; }
    seen.add(row.id);
    total += row.amount;
  }
  total = total * 2;
  skipped = skipped * 2;
  errors.push("done");
  seen.add("done");
  return { total, skipped, errors, seen };
}`,
    },
    {
      name: "a one-off script is not shipped module graph",
      filename: "/repo/scripts/backfill-invoices.ts",
      code: `export function backfill(rows: Row[]): Summary {
  let total = 0;
  let skipped = 0;
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (row.void) { skipped += 1; errors.push(row.id); continue; }
    seen.add(row.id);
    total += row.amount;
  }
  total = total * 2;
  skipped = skipped * 2;
  errors.push("done");
  seen.add("done");
  return { total, skipped, errors, seen };
}`,
    },
  ],
});
