#!/usr/bin/env bun
/**
 * The structural-check regression suite.
 *
 * A check's failure mode is silent. When its matcher stops matching it does not
 * error — it reports nothing, and a clean run is indistinguishable from a
 * working one. Reading the check does not catch this either, because the reader
 * shares the author's blind spot: the same reasoning that produced the gap
 * reads straight past it.
 *
 * prop-count is the worked example. It matched its parameter list as
 * `\(([^)]*)\)`, needing the whole signature on one line, so it found 32 of this
 * repo's 121 components — precisely the small ones, which are the only ones that
 * could never breach an 8-prop threshold. It was green the entire time.
 *
 * Every case here is ADVERSARIAL: the violation written the way the previous
 * matcher missed it. Each case carries a legal neighbour too, because
 * over-matching is invisible to positive fixtures and is the defect that
 * actually costs — a check that warns about a four-prop component is one people
 * learn to scroll past.
 *
 * Usage: bun oxlint/scripts/check-fixtures.ts
 */

import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const SCRIPTS_DIR = import.meta.dir;

// The fixture tree is a synthetic repo — it carries its own apps/web/src and
// packages/core/src so the checks can be pointed at it wholesale via
// ARCH_SOURCE_ROOT. It sits at the repo root rather than inside apps/web
// because a fake repo nested in the real one confuses every glob that walks the
// app, and because file-size's second root is packages/core.
const FIXTURE_ROOT = resolve(
  SCRIPTS_DIR,
  "../../../..",
  "architecture-fixtures",
);

// file-size is the one check whose fixture must BE a certain length, so its
// three cases are ~1,750 lines of `export const bulkAlpha1 = 1;` filler that
// nobody reads and every grep has to wade through. Written for the duration of
// the run and removed after: the line count is the entire content of the test,
// so stating it as a number says more than 616 lines of it do.
const PADDING = [
  // Over the 600-line hard limit — this one must BLOCK.
  {
    path: "apps/web/src/features/alpha/lib/oversized.ts",
    lines: 616,
    symbol: "bulkAlpha",
  },
  // Between the 500 warn threshold and the 600 limit, so it must only WARN. A
  // single fixture past both thresholds would leave the warn branch unproven.
  {
    path: "apps/web/src/features/alpha/lib/large-neighbour.ts",
    lines: 525,
    symbol: "warnAlpha",
  },
  // file-size scans TWO roots and every other fixture lives under apps/web/src,
  // so packages/core/src was declared and never exercised. A check pointed at a
  // path that does not exist still returns cleanly — collectSourceFiles treats a
  // missing root as "nothing to say" by design — so an unexercised root is
  // indistinguishable from a working one.
  {
    path: "packages/core/src/oversized-core.ts",
    lines: 612,
    symbol: "coreBulk",
  },
];

type Expectation = {
  check: string;
  /**
   * Every finding the check must report, as `FAIL <path>` or `WARN <path>`,
   * listed ONCE PER OCCURRENCE. Compared as a multiset: a missing entry is
   * UNDER-MATCHED, an extra one OVER-MATCHED.
   *
   * Severity and count are both part of the expectation, and both had to be,
   * because comparing bare paths as a set silently accepted three distinct
   * regressions:
   *
   *   - a check with four independent matchers reporting from one file passed
   *     with three of them deleted, since the fourth kept the file present
   *   - a hard error demoted to a warning passed, since the path was unchanged
   *   - five findings where one was expected passed
   *
   * The line number is deliberately NOT part of it. Some checks print `path`
   * and some `path:line`, and pinning lines means editing a fixture's comment
   * header breaks an unrelated expectation — which teaches people to re-baseline
   * without reading why it moved. Multiplicity recovers most of what a line
   * would have caught.
   */
  fires: string[];
};

/** Entries of `a` with one occurrence removed for each matching entry of `b`. */
function multisetDifference(a: string[], b: string[]): string[] {
  const remaining = new Map<string, number>();
  for (const entry of b) remaining.set(entry, (remaining.get(entry) ?? 0) + 1);

  const out: string[] = [];
  for (const entry of a) {
    const count = remaining.get(entry) ?? 0;
    if (count > 0) remaining.set(entry, count - 1);
    else out.push(entry);
  }
  return out;
}

const EXPECTATIONS: Expectation[] = [
  {
    check: "prop-count",
    // Three blind spots have to stay closed for this to report: the generic
    // declaration must be found, the signature must be accumulated across
    // lines, and the counted region must stop at the destructure's own closing
    // brace rather than swallowing the inline type literal after it. See the
    // header of wide-generic.tsx.
    fires: [
      "WARN apps/web/src/features/alpha/ui/wide-generic.tsx",
      "WARN apps/web/src/features/alpha/ui/wide-typed.tsx",
    ],
  },
  {
    check: "cross-boundary-alias",
    // The sibling crossing and the long climb are both here because a specifier
    // matcher catches the second and misses the first, and the sibling is the
    // likelier crossing. Three legal neighbours guard the over-match side: a
    // within-feature relative import, an asset that resolves across a boundary,
    // and two files sharing the source root.
    // The four wrapped files cover specifiers a formatter broke onto their own
    // line. No single line carries both halves, so anything reading one line at a
    // time loses the edge entirely — absent, not wrong, the shape with no symptom.
    //
    // The rest cover telling code from text, which is the whole reason this uses a
    // real reader rather than a pattern. Each one is a syntax class that makes a
    // pattern lose or invent a file: a `${…}` interpolation is code and must be
    // read, a backtick in a quoted string or in a regex literal must not open a
    // template region and swallow the statements after it, and a generic arrow in
    // a .ts file must not be read as JSX.
    fires: [
      "FAIL apps/web/src/features/alpha/ui/interpolated-crossing.ts",
      "FAIL apps/web/src/features/alpha/ui/long-climb-crossing.ts",
      "FAIL apps/web/src/features/alpha/ui/quoted-backtick-crossing.ts",
      "FAIL apps/web/src/features/alpha/ui/regex-tick-crossing.ts",
      "FAIL apps/web/src/features/alpha/ui/generic-arrow-crossing.ts",
      "FAIL apps/web/src/features/alpha/ui/escaped-specifier-crossing.ts",
      "FAIL apps/web/src/features/alpha/ui/sibling-crossing.ts",
      "FAIL apps/web/src/features/alpha/ui/wrapped-dynamic-crossing.ts",
      "FAIL apps/web/src/features/alpha/ui/wrapped-require-crossing.ts",
      "FAIL apps/web/src/features/alpha/ui/wrapped-static-crossing.ts",
      "FAIL apps/web/src/features/alpha/ui/wrapped-static-crossing.ts",
    ],
  },
  {
    check: "css-tokens",
    // Two matchers, so two files. Held together they masked each other: either
    // one kept the file reporting, so breaking the color regex left the suite
    // green. tokenised.css is the neighbour, and it stays silent through three
    // separate exemptions — a var() reference, a --custom-prop definition, and
    // a relative `em` the absolute scale cannot express.
    fires: [
      "FAIL apps/web/src/features/alpha/ui/raw-color.css",
      "FAIL apps/web/src/features/alpha/ui/raw-font-size.css",
    ],
  },
  {
    check: "file-size",
    // Two thresholds and two roots. oversized.ts crosses the 600 hard limit and
    // blocks, large-neighbour.ts sits between 500 and 600 and only warns, and
    // oversized-core.ts covers packages/core/src — the second declared root,
    // which no fixture reached and which would have returned cleanly forever.
    // The severities are the point: oversized.ts must BLOCK and
    // large-neighbour.ts must only WARN. Comparing paths alone accepted the
    // hard limit being demoted to a warning without a word.
    fires: [
      "WARN apps/web/src/features/alpha/lib/large-neighbour.ts",
      "FAIL apps/web/src/features/alpha/lib/oversized.ts",
      "FAIL packages/core/src/oversized-core.ts",
    ],
  },
  {
    check: "hook-count",
    // Seven hooks, AT the threshold rather than far past it — an off-by-one in
    // the comparison is the change that would otherwise go unnoticed. The
    // neighbour sits one under for the same reason.
    // One per ROOT. hook-count scans features, shared/ui and routes, and only
    // features was exercised — a root that scans nothing returns cleanly and is
    // indistinguishable from a root that works.
    fires: [
      "WARN apps/web/src/features/alpha/ui/many-hooks.tsx",
      "WARN apps/web/src/routes/many-hooks-route.tsx",
      "WARN apps/web/src/shared/ui/many-hooks-shared.tsx",
    ],
  },
  {
    check: "shadow-source",
    // Both spellings, because they are separate branches chosen by extension:
    // `box-shadow` in CSS and `boxShadow` in TSX. shadows.css holds one too and
    // must stay silent — it is the allowlist the rule points people at.
    fires: [
      "FAIL apps/web/src/features/alpha/ui/inline-shadow.tsx",
      "FAIL apps/web/src/features/alpha/ui/stray-shadow.css",
    ],
  },
  {
    check: "single-component-export",
    // A declaration plus a zero-parameter arrow, the shape most likely to be
    // tucked in beside a real component. Two neighbours guard the other side: a
    // context and a constant that a name-only test would count, and an
    // Object.assign compound, which is the escape hatch this rule recommends.
    fires: ["WARN apps/web/src/features/alpha/ui/two-components.tsx"],
  },
  {
    check: "token-equality",
    // Listed FOUR TIMES, once per matcher. They are four separate regexes and
    // they all report the same file, so a set comparison collapsed them to one
    // entry — three of the four could be deleted and this stayed green. The
    // count is the only thing standing between that and a real expectation.
    // off-scale-neighbour.tsx carries the values that only look like violations.
    fires: [
      "FAIL apps/web/src/features/alpha/ui/on-scale-spacing.tsx",
      "FAIL apps/web/src/features/alpha/ui/on-scale-spacing.tsx",
      "FAIL apps/web/src/features/alpha/ui/on-scale-spacing.tsx",
      "FAIL apps/web/src/features/alpha/ui/on-scale-spacing.tsx",
    ],
  },
];

// The orchestrator prints one line per finding as `FAIL [check] path` or
// `WARN [check] path`, then indented detail. Only the first line is asserted —
// the detail is prose for a human and should be free to change.
const FINDING = /^(FAIL|WARN) \[([^\]]+)\] (\S+)/gm;

// Some checks append `:<line>` to that path and some do not. Expectations are
// declared per FILE deliberately: pinning line numbers would mean any edit to a
// fixture's comment header breaks the suite somewhere unrelated, which trains
// people to update expectations without reading why they moved.
function fixturePath(reported: string): string {
  return reported.replace(/:\d+$/, "");
}

// One per check that returned and had its findings consumed. This is the only
// evidence that a check RAN — findings cannot supply it, because "found
// nothing" and "never executed" produce identical output.
const RAN = /^RAN \[([^\]]+)\]/gm;

// The generated padding exists only while the child is reading it: written here,
// removed in the `finally` whether the run passed, failed, or threw. Everything
// below works off `result`, so by the first assertion the tree is back to its 38
// committed fixtures and nothing surprising is left in the working copy.
function runStructuralChecks() {
  for (const { path, lines, symbol } of PADDING) {
    const absolute = join(FIXTURE_ROOT, path);
    mkdirSync(dirname(absolute), { recursive: true });
    const body = Array.from(
      { length: lines },
      (_, i) => `export const ${symbol}${i + 1} = ${i + 1};`,
    );
    writeFileSync(absolute, `${body.join("\n")}\n`);
  }

  try {
    return spawnSync("bun", [join(SCRIPTS_DIR, "check-structure.ts")], {
      encoding: "utf8",
      env: {
        ...process.env,
        ARCH_SOURCE_ROOT: FIXTURE_ROOT,
        ARCH_EMIT_RAN: "1",
        STAGED_FILES: undefined,
      },
    });
  } finally {
    for (const { path } of PADDING) {
      rmSync(join(FIXTURE_ROOT, path), { force: true });
    }
  }
}

const result = runStructuralChecks();

let failed = 0;

if (result.error !== undefined) {
  console.error(`FAIL [fixtures] PROCESS ${result.error.message}`);
  process.exit(1);
}

const output = `${result.stdout}${result.stderr}`;

// A run is trusted only when its summary line and its exit status AGREE. Either
// signal alone is insufficient, and each was wrong here in turn:
//
//   - Exit status alone cannot answer "did this finish". A BLOCKING check whose
//     adversarial fixture fires exits 1, which is the suite working.
//   - Findings alone cannot either, and fail silently: a throwing check prints
//     nothing, and every `fires: []` expectation passes vacuously when its check
//     never ran, so a throw in the LAST check reported the whole suite CLEAN.
//   - The summary alone accepts abnormal termination AFTER it prints. A SIGTERM
//     following the summary was accepted as a clean run.
//
// check-structure.ts prints the summary only once every check has RETURNED, and
// pairs it with a fixed status: 0 for passed, 1 for failed. Anything else — a
// missing summary, a mismatched status, any signal at all — is a broken run.
const PASSED = /^Structural checks passed/m;
const FAILED = /^Structural checks failed/m;

const expectedStatus = PASSED.test(output)
  ? 0
  : FAILED.test(output)
    ? 1
    : undefined;

if (
  result.signal != null ||
  expectedStatus === undefined ||
  result.status !== expectedStatus
) {
  const reason =
    result.signal != null
      ? `was killed by ${result.signal}`
      : expectedStatus === undefined
        ? "printed no summary, so it did not finish"
        : `exited ${result.status} after reporting it ${expectedStatus === 0 ? "passed" : "failed"}`;
  console.error(`FAIL [fixtures] check-structure ${reason}.`);
  console.error(output);
  process.exit(1);
}

// Every declared check must have RUN. Without this, deleting a check from the
// orchestrator, renaming it, stubbing it to return empty arrays, or pointing it
// at a root that does not exist all leave its `fires: []` expectation passing
// on zero findings — the suite reports clean while the check is simply gone.
// Counted, not collected into a set: a check registered twice would run twice
// and its findings would be duplicated, which a set silently normalises away.
const ranCounts = new Map<string, number>();
for (const [, name] of output.matchAll(RAN)) {
  ranCounts.set(name, (ranCounts.get(name) ?? 0) + 1);
}

const declared = new Set(EXPECTATIONS.map(({ check }) => check));

for (const check of declared) {
  const times = ranCounts.get(check) ?? 0;
  if (times === 1) continue;
  failed += 1;
  console.error(
    times === 0
      ? `FAIL [fixtures] ${check} never ran — it is declared here but the orchestrator\n` +
          `  did not report it. Its expectations have been passing on zero findings.`
      : `FAIL [fixtures] ${check} ran ${times} times — it is registered more than once,\n` +
          `  so every finding it makes is duplicated.`,
  );
}

// The reverse: a check that ran but nobody declared. The findings comparison
// below catches this only when it reports something, so a new check that is
// silent on the fixtures would otherwise join the tier with no coverage at all.
for (const check of ranCounts.keys()) {
  if (declared.has(check)) continue;
  failed += 1;
  console.error(
    `FAIL [fixtures] ${check} ran but is not declared in EXPECTATIONS.\n` +
      `  Add it, with an empty 'fires' if it should stay silent on the fixtures.`,
  );
}

// Every occurrence kept, tagged with its severity. Collapsing to a set of
// paths is what let a four-matcher check pass with three matchers deleted.
const reportedByCheck = new Map<string, string[]>();
for (const [, severity, check, path] of output.matchAll(FINDING)) {
  const list = reportedByCheck.get(check) ?? [];
  list.push(`${severity} ${fixturePath(path)}`);
  reportedByCheck.set(check, list);
}

for (const { check, fires } of EXPECTATIONS) {
  const reported = [...(reportedByCheck.get(check) ?? [])].sort();
  reportedByCheck.delete(check);
  const expected = [...fires].sort();

  const missed = multisetDifference(expected, reported);
  const spurious = multisetDifference(reported, expected);

  if (missed.length === 0 && spurious.length === 0) {
    console.log(
      `[fixtures] ${check} — ${expected.length} adversarial case(s) caught`,
    );
    continue;
  }

  failed += 1;
  console.error(`FAIL [fixtures] ${check}`);
  for (const entry of missed) {
    console.error(
      `  MISSED  ${entry} — the check no longer catches this. It is the case that matters.`,
    );
  }
  for (const entry of spurious) {
    console.error(
      `  SPURIOUS  ${entry} — reported something the fixtures say is legal.`,
    );
  }
}

// A check that reports against the fixtures but has no expectation is either a
// new check nobody declared or a renamed one whose expectation is now dead.
// Both read as coverage that isn't there.
for (const [check, paths] of reportedByCheck) {
  failed += 1;
  console.error(
    `FAIL [fixtures] ${check} — reported ${paths.join(", ")} with no expectation.`,
  );
  console.error(
    `  Add it to EXPECTATIONS, with an empty 'fires' if it should stay silent.`,
  );
}

if (failed > 0) {
  console.error(`\n${failed} check(s) no longer match their fixtures.`);
  process.exit(1);
}

console.log("[fixtures] clean");
