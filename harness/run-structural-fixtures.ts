#!/usr/bin/env bun
/**
 * Proves every structural check in the skill catches what its doc claims.
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
 * one shared tree under `structural-fixtures/tree/`, and the checks are pointed at
 * it wholesale by `structural-fixtures/config.ts` — which is also the worked example
 * of adopting this tier by writing config and nothing else.
 *
 *     bun run check:structural
 *
 * Revert-probe after any change here. Break a check and expect its adversarial
 * kind to report MISSED; delete a check from the registry and expect the runner
 * to say so rather than pass on zero findings. A harness that stays green
 * through both is not testing anything.
 */

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  BOTH_FIXTURE_TREES,
  DECLARED_FIXTURE_TREES,
  FIXTURE_TREE,
  fixtureConfig,
  PDF_TREE,
} from "./structural-fixtures/config.ts";
import type { CheckFixtures, GeneratedFixture } from "./structural-fixtures/expectations.ts";
import type { Finding } from "../skills/enforced-architecture/references/lint/structural/check-substrate.ts";
import {
  runStructuralChecks,
  type CheckRun,
} from "../skills/enforced-architecture/references/lint/structural/run-structural-checks.ts";
import { structuralChecks } from "../skills/enforced-architecture/references/lint/structural/registry.ts";

const HARNESS_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HARNESS_DIR, "..");
const STRUCTURAL_ROOT = join(REPO_ROOT, "skills/enforced-architecture/references/lint/structural");
const EXPECTATIONS_ROOT = join(HARNESS_DIR, "structural-fixtures/expectations");

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
  // A check whose header states no value line is a check nobody can select. The
  // header is the ONLY documentation that reaches the project the check is
  // copied into, so an omission here is invisible until someone is reading a
  // finding in a repo that has no catalog.
  else if (!statesWhatItBuys(implementation)) {
    fail(
      id,
      `registered, but its header opens with no "Makes sure:" (blocking) or ` +
        `"Shows:" (warning) line, so nothing says what the check buys`,
    );
  }
  if (!fixturesByCheck.has(id)) {
    fail(
      id,
      `registered, but no expectations at structural-fixtures/expectations/${id}.ts, ` +
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
let runs: CheckRun[];
let bothTrees: CheckRun[];
try {
  runs = runStructuralChecks(structuralChecks, fixtureConfig, DECLARED_FIXTURE_TREES);
  // The probe reuses the same registry and config and varies ONLY the tree list,
  // because that is the claim: declaring a tree is the whole of what turns the
  // catalog on over it.
  bothTrees = runStructuralChecks(structuralChecks, fixtureConfig, BOTH_FIXTURE_TREES);
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

/**
 * Findings and crashes gathered per check id, across every tree it ran on.
 *
 * A tree-scoped check produces one run PER declared tree, and the expectations
 * are written against the whole fixture project rather than against one tree —
 * so they are compared against the union. What the union must NOT hide is a run
 * that never happened, which is why the caller asserts the run count separately.
 */
function byCheckId(source: CheckRun[]): Map<string, { findings: Finding[]; crashed: Error | undefined }> {
  const merged = new Map<string, { findings: Finding[]; crashed: Error | undefined }>();
  for (const run of source) {
    const entry = merged.get(run.id) ?? { findings: [], crashed: undefined };
    entry.findings.push(...run.findings);
    entry.crashed ??= run.crashed;
    merged.set(run.id, entry);
  }
  return merged;
}

// ── The two-tree probe ───────────────────────────────────────────────────────
//
// The claim the declared-tree design rests on, as a test rather than as prose:
// an undeclared tree produces NOTHING, declaring it turns every tree-scoped
// check on over it, and the tree is read with its own vocabulary rather than the
// first tree's. A catalog that reports the same either way has a scope nobody
// can rely on; one that reports nothing either way has a scope that never
// engaged.

const PROBE_ROOT = `${PDF_TREE.root}/`;
const findingsUnder = (source: CheckRun[], prefix: string): string[] =>
  source.flatMap(({ id, findings }) =>
    findings.filter((finding) => finding.file.startsWith(prefix)).map((f) => `[${id}] ${f.file}`),
  );

const silentWhileUndeclared = findingsUnder(runs, PROBE_ROOT);
if (silentWhileUndeclared.length > 0) {
  fail(
    "<declared-trees>",
    `an UNDECLARED tree produced findings, so rules are not scoped to declared trees:\n` +
      `        ${silentWhileUndeclared.join("\n        ")}`,
  );
}

const firesOnceDeclared = findingsUnder(bothTrees, PROBE_ROOT);
const expectedProbeFinding = `[placement/topology] ${PDF_TREE.root}/lib/stray.ts`;
if (!firesOnceDeclared.includes(expectedProbeFinding)) {
  fail(
    "<declared-trees>",
    `declaring ${PDF_TREE.root} did not turn the checks on over it — expected ` +
      `${expectedProbeFinding}, got ${firesOnceDeclared.length === 0 ? "nothing" : firesOnceDeclared.join(", ")}`,
  );
}

// Read with the app tree's vocabulary, `capabilities/` is not a top-level
// directory and topology reports every file under it. Read with its own, it is
// the features directory.
const wrongVocabulary = firesOnceDeclared.filter((entry) =>
  entry.includes(`${PDF_TREE.root}/capabilities/`),
);
if (wrongVocabulary.length > 0) {
  fail(
    "<declared-trees>",
    `a declared tree was read with another tree's vocabulary:\n` +
      `        ${wrongVocabulary.join("\n        ")}`,
  );
}

// Declaring a second tree must not change the first tree's verdicts. Without
// this, a probe that silenced the app tree entirely would still look like it
// passed the two assertions above.
const appFindings = (source: CheckRun[]): string[] =>
  source
    .flatMap(({ id, findings }) => findings.map((f) => `[${id}] ${f.severity} ${f.file}`))
    .filter((entry) => !entry.includes(PROBE_ROOT))
    .sort();
if (appFindings(runs).join("\n") !== appFindings(bothTrees).join("\n")) {
  fail(
    "<declared-trees>",
    "declaring a second tree changed what the first tree reports — trees are not independent",
  );
}

// ── Compare ──────────────────────────────────────────────────────────────────

let proved = 0;

for (const [id, { findings, crashed }] of byCheckId(runs)) {
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
  for (const expectation of fixtures.messages ?? []) {
    const { path } = expectation;
    const messages = findings.filter((finding) => finding.file === path).map((f) => f.message);
    const quoted = () =>
      messages.map((message) => `          ${message.replace(/\n/g, "\n          ")}`).join("\n");

    if (messages.length === 0) {
      fail(id, `UNSAID ${path} — no finding at all, so its wording asserts nothing`);
      continue;
    }
    if ("contains" in expectation && !messages.some((m) => m.includes(expectation.contains))) {
      fail(
        id,
        `UNSAID ${path} — no finding says ${JSON.stringify(expectation.contains)}. Reported:\n${quoted()}`,
      );
    }
    if ("absent" in expectation && messages.some((m) => m.includes(expectation.absent))) {
      fail(
        id,
        `OVER-SAID ${path} — a finding says ${JSON.stringify(expectation.absent)}, ` +
          `which this case is the witness against. Reported:\n${quoted()}`,
      );
    }
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
  `\n${proved}/${registeredIds.length} structural checks proved against their ` +
    `obvious / adversarial / legal fixtures.`,
);
process.exit(failures.length === 0 ? 0 : 1);

/**
 * Whether a check's banner states what the check buys, rather than what it
 * matches. `Makes sure:` claims a property the codebase can rely on and is for
 * blocking checks; `Shows:` reports something a reader learns and is for
 * warnings.
 *
 * Presence only — no linter can tell a concrete claim from abstract praise, and
 * pretending otherwise would put a green tick on exactly the sentences this
 * format exists to stop.
 */
function statesWhatItBuys(implementationPath: string): boolean {
  const banner = readFileSync(implementationPath, "utf8").split("\n");
  const end = banner.findIndex((line) => !line.startsWith("//"));
  return banner
    .slice(0, end === -1 ? banner.length : end)
    .some((line) => /^\/\/ (Makes sure|Shows):/.test(line));
}
