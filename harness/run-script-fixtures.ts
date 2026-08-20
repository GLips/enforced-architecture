#!/usr/bin/env bun
/**
 * Proves every structural-script check in the skill catches what its doc claims.
 *
 * The tier's failure mode is silent by construction. When a check's matcher
 * stops matching it does not error — it reports nothing, and a clean run is
 * indistinguishable from a working one. Reading the check does not catch it
 * either, because the reader shares the author's blind spot: the same reasoning
 * that produced the gap reads straight past it.
 *
 * `style/css-tokens` is the worked example. Its unit of matching is the CSS
 * declaration, and it once matched a LINE — so a value wrapped onto the line
 * after its property was invisible, read as a property with no unit followed by
 * a unit with no property. Every hand-formatted stylesheet went unchecked, and
 * the run was green the entire time.
 *
 * Unlike the oxlint tier, these checks scan declared roots rather than being
 * handed a file, and several scan more than one. So the cases are real files in
 * one shared tree under `script-fixtures/tree/`, and the checks are pointed at
 * it wholesale by `script-fixtures/config.ts` — which is also the worked example
 * of adopting this tier by writing config and nothing else.
 *
 *     bun run check:scripts
 *
 * Revert-probe after any change here. Break a check and expect its adversarial
 * kind to report MISSED; delete a check from the registry and expect the runner
 * to say so rather than pass on zero findings. A harness that stays green
 * through both is not testing anything.
 */

import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { FIXTURE_TREE, fixtureConfig } from "./script-fixtures/config.ts";
import type { CheckFixtures, GeneratedFixture } from "./script-fixtures/expectations.ts";
import { runStructuralChecks } from "../skills/enforced-architecture/references/lint/structural/run-structural-checks.ts";
import { structuralChecks } from "../skills/enforced-architecture/references/lint/structural/registry.ts";

const HARNESS_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HARNESS_DIR, "..");
const STRUCTURAL_ROOT = join(REPO_ROOT, "skills/enforced-architecture/references/lint/structural");
const EXPECTATIONS_ROOT = join(HARNESS_DIR, "script-fixtures/expectations");

const KINDS = ["obvious", "adversarial", "legal"] as const;

type Failure = { check: string; detail: string };

const failures: Failure[] = [];
const fail = (check: string, detail: string) => failures.push({ check, detail });

// ── Load the expectations ────────────────────────────────────────────────────

const expectationPaths = [
  ...new Bun.Glob("**/*.ts").scanSync({ cwd: EXPECTATIONS_ROOT, absolute: true }),
].sort();

const fixturesByCheck = new Map<string, CheckFixtures>();
for (const path of expectationPaths) {
  const id = relative(EXPECTATIONS_ROOT, path).replace(/\.ts$/, "");
  const module: Record<string, unknown> = await import(path);
  const declared = Object.values(module).find(
    (value): value is CheckFixtures =>
      typeof value === "object" && value !== null && "check" in value,
  );

  if (declared === undefined) {
    fail(id, `${relative(REPO_ROOT, path)} exports no CheckFixtures object`);
    continue;
  }
  // The filename is the id, so a file aimed at another check is a file whose
  // expectations nobody will find when that check changes.
  if (declared.check !== id) {
    fail(id, `declares check "${declared.check}" but sits at expectations/${id}.ts`);
    continue;
  }
  fixturesByCheck.set(id, declared);
}

// ── Structural checks the expectations cannot make about themselves ──────────

const registeredIds = structuralChecks.map((check) => check.id);

for (const id of registeredIds) {
  const implementation = join(STRUCTURAL_ROOT, `${id}.ts`);
  if (!existsSync(implementation)) {
    fail(id, `registered, but there is no structural/${id}.ts — the id and the file disagree`);
  }
  // A check with no doc is a check whose intent, negative space, and adapt notes
  // live nowhere. The catalog indexes rules by their doc; an undocumented one is
  // unreachable from `overview.md`.
  if (!existsSync(join(STRUCTURAL_ROOT, `${id}.md`))) {
    fail(id, `registered, but there is no structural/${id}.md to say what it is for`);
  }
  if (!fixturesByCheck.has(id)) {
    fail(
      id,
      `registered, but no expectations at script-fixtures/expectations/${id}.ts, ` +
        `so nothing exercises it`,
    );
  }
}

for (const id of fixturesByCheck.keys()) {
  if (registeredIds.includes(id)) continue;
  fail(id, "has expectations but is not registered in structural/registry.ts — it never runs");
}

const duplicates = registeredIds.filter((id, index) => registeredIds.indexOf(id) !== index);
for (const id of new Set(duplicates)) {
  fail(id, "is registered more than once, so every finding it makes is duplicated");
}

for (const [id, fixtures] of fixturesByCheck) {
  for (const kind of KINDS) {
    if (fixtures[kind].length === 0) fail(id, `the ${kind} case list is empty, so it asserts nothing`);
  }
  for (const path of fixtures.legal) {
    if (!existsSync(join(FIXTURE_TREE, path))) {
      fail(id, `legal neighbour ${path} is not in the tree — that coverage is gone`);
    }
  }
}

// ── Run ──────────────────────────────────────────────────────────────────────

const generated: GeneratedFixture[] = [...fixturesByCheck.values()].flatMap(
  (fixtures) => fixtures.generated ?? [],
);

function writeGeneratedFixtures(): void {
  for (const { path, lines, symbol } of generated) {
    const absolute = join(FIXTURE_TREE, path);
    mkdirSync(dirname(absolute), { recursive: true });
    const body = Array.from({ length: lines }, (_, i) => `export const ${symbol}${i + 1} = ${i + 1};`);
    writeFileSync(absolute, `${body.join("\n")}\n`);
  }
}

function removeGeneratedFixtures(): void {
  for (const { path } of generated) rmSync(join(FIXTURE_TREE, path), { force: true });
}

writeGeneratedFixtures();
let runs;
try {
  runs = runStructuralChecks(structuralChecks, fixtureConfig);
} finally {
  // Removed whether the run passed, failed, or threw, so by the first assertion
  // below the tree is back to its committed fixtures and nothing surprising is
  // left in the working copy.
  removeGeneratedFixtures();
}

// ── Compare ──────────────────────────────────────────────────────────────────

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

let proved = 0;

for (const { id, findings, crashed } of runs) {
  const before = failures.length;

  if (crashed !== undefined) {
    fail(id, `threw and reported nothing:\n        ${(crashed.stack ?? crashed.message).replace(/\n/g, "\n        ")}`);
  }

  const fixtures = fixturesByCheck.get(id);
  if (fixtures === undefined) continue;

  const reported = findings.map(
    (finding) => `${finding.severity === "error" ? "FAIL" : "WARN"} ${finding.file}`,
  );
  // Both kinds draw from ONE pool, consumed as they match. Comparing each kind
  // against the full report independently lets them claim the same findings, so
  // a check reporting 3× on a path listed twice in each kind passes on both —
  // which is precisely the under-count the multiset exists to catch. Whatever
  // survives the pool is spurious.
  //
  // Which kind a missed case belongs to is worth saying: an adversarial miss
  // means the check works on the shape its author imagined and not on the one
  // that beats it, which is a different bug report than an obvious miss.
  let unclaimed = reported;
  for (const kind of ["obvious", "adversarial"] as const) {
    for (const entry of multisetDifference(fixtures[kind], unclaimed)) {
      fail(id, `MISSED (${kind}) ${entry} — the check no longer catches this`);
    }
    unclaimed = multisetDifference(unclaimed, fixtures[kind]);
  }
  for (const entry of unclaimed) {
    fail(id, `SPURIOUS ${entry} — reported something no expectation claims`);
  }
  for (const path of fixtures.legal) {
    const hits = findings.filter((finding) => finding.file === path).length;
    if (hits > 0) fail(id, `OVER-MATCHED ${path} — reported ${hits}× on a legal neighbour`);
  }

  if (failures.length === before) {
    proved += 1;
    console.log(
      `  PASS  ${id} — ${fixtures.obvious.length} obvious, ${fixtures.adversarial.length} adversarial, ` +
        `${fixtures.legal.length} legal`,
    );
  }
}

// ── Report ───────────────────────────────────────────────────────────────────

const failedChecks = new Set(failures.map((failure) => failure.check));
for (const check of [...failedChecks].sort()) {
  console.log(`  FAIL  ${check}`);
  for (const { detail } of failures.filter((failure) => failure.check === check)) {
    console.log(`        ${detail}`);
  }
}

console.log(
  `\n${proved}/${registeredIds.length} structural-script checks proved against their ` +
    `obvious / adversarial / legal fixtures.`,
);
process.exit(failures.length === 0 ? 0 : 1);
