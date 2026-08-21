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

import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  APP_TREE,
  BOTH_FIXTURE_TREES,
  DECLARED_FIXTURE_TREES,
  FIXTURE_TREE,
  fixtureConfig,
  PDF_TREE,
  APP_TREE_TYPE_UNCHECKED,
  PDF_TREE_MISREAD,
} from "./structural-fixtures/config.ts";
import type { CheckFixtures, GeneratedFixture } from "./structural-fixtures/expectations.ts";
import { SOURCE_EXTENSIONS } from "../skills/enforced-architecture/references/lint/policy/layout.ts";
import { declareTrees } from "../skills/enforced-architecture/references/lint/policy/declared-trees.ts";
import { createTreeModuleResolver } from "../skills/enforced-architecture/references/lint/structural/module-resolution.ts";
import type { ArchitectureConfig } from "../skills/enforced-architecture/references/lint/structural/config.ts";
import {
  createTreeContexts,
  type Finding,
  type StructuralCheck,
} from "../skills/enforced-architecture/references/lint/structural/check-substrate.ts";
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
  // A check whose header states no value line is a check whose findings nobody
  // can act on. The header is the ONLY documentation that reaches the project
  // the check is copied into, so an omission here is invisible until someone is
  // reading a finding in a repo that has no catalog.
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

/**
 * Every `(run label, check id, tree root)` the harness OBSERVED being invoked.
 *
 * Recorded by wrapping each check's `run` before handing it to the runner, so
 * the evidence is produced here rather than by the code under test. That
 * distinction is the whole point: `CheckRun[]` is the runner's own report of
 * what it did, and a runner that skips a check while still emitting a record
 * with the right id and tree satisfies any assertion made from it. A review did
 * exactly that and the suite reported 16/16.
 */
const invocations: string[] = [];

function spiedChecks(label: string): StructuralCheck[] {
  return structuralChecks.map((check) =>
    check.scope === "project"
      ? {
          ...check,
          run: (context: Parameters<typeof check.run>[0]) => {
            invocations.push(`${label} | ${check.id} | <project>`);
            return check.run(context);
          },
        }
      : {
          ...check,
          run: (context: Parameters<typeof check.run>[0]) => {
            invocations.push(`${label} | ${check.id} | ${context.tree.root}`);
            return check.run(context);
          },
        },
  );
}

writeGeneratedFixtures();
let runs: CheckRun[];
let bothTrees: CheckRun[];
let misread: CheckRun[];
try {
  runs = await runStructuralChecks(spiedChecks("declared"), fixtureConfig, DECLARED_FIXTURE_TREES);
  // The probe reuses the same registry and config and varies ONLY the tree list,
  // because that is the claim: declaring a tree is the whole of what turns the
  // catalog on over it.
  bothTrees = await runStructuralChecks(spiedChecks("both"), fixtureConfig, BOTH_FIXTURE_TREES);
  // The positive control for the vocabulary assertion below. Same root, wrong
  // vocabulary — see PDF_TREE_MISREAD for why the negative alone is not enough.
  misread = await runStructuralChecks(spiedChecks("misread"), fixtureConfig, PDF_TREE_MISREAD);
} finally {
  // Removed whether the run passed, failed, or threw, so by the first assertion
  // below the tree is back to its committed fixtures and nothing surprising is
  // left in the working copy.
  removeGeneratedFixtures();
}

/**
 * The exact `(check id, tree)` multiset every run must produce: one run per
 * declared tree for every tree-scoped check, and one run total for every
 * project-scoped one.
 *
 * This is the assertion the merge above cannot make. Without it, a runner that
 * quietly stops iterating trees — or one that special-cases a single check —
 * still produces findings that merge to the expected union, and every per-check
 * comparison passes. An external review changed the runner to skip the second
 * tree for every tree-scoped check but `placement/topology` and this suite
 * reported 16/16 green.
 *
 * Compared as a sorted multiset rather than a count, so a check run TWICE on one
 * tree and never on another cannot balance out.
 */
function assertEveryCheckRanOnEveryTree(
  label: string,
  trees: readonly { root: string }[],
): void {
  const expected = structuralChecks
    .flatMap((check) =>
      check.scope === "project"
        ? [`${label} | ${check.id} | <project>`]
        : trees.map((tree) => `${label} | ${check.id} | ${tree.root}`),
    )
    .sort();
  const actual = invocations.filter((entry) => entry.startsWith(`${label} | `)).sort();

  const missing = multisetDifference(expected, actual);
  const unexpected = multisetDifference(actual, expected);
  if (missing.length > 0) {
    fail("<declared-trees>", `${label}: never ran — ${missing.join(", ")}`);
  }
  if (unexpected.length > 0) {
    fail("<declared-trees>", `${label}: ran where nothing asked it to — ${unexpected.join(", ")}`);
  }
}

assertEveryCheckRanOnEveryTree("declared", DECLARED_FIXTURE_TREES);
assertEveryCheckRanOnEveryTree("both", BOTH_FIXTURE_TREES);
assertEveryCheckRanOnEveryTree("misread", PDF_TREE_MISREAD);

// ── The graph's targets are resolved, not spelled ────────────────────────────
//
// Every check in this tier reads `edge.target`, and every one of them compares
// it with the extension stripped or on a prefix of its segments — so the whole
// suite stays green when the graph stops resolving and goes back to arithmetic
// on the specifier text. It was green through exactly that swap. No fixture can
// catch it, because no fixture's VERDICT changes: what changes is whether the
// answer names a module or a guess.
//
// So the assertion is about the substrate rather than about a finding. A target
// either names a file that is there, or names a position nothing on disk backs —
// and the second is a real answer, not a failure: an import of a module that is
// mid-rename or declared only in a `.d.ts` still crosses whatever boundary it
// crosses, and dropping it is how a boundary rule reports clean over an import
// nobody checked.
//
// What a target may NOT be is a directory THAT HOLDS A CLIENT BARREL. That is
// the signature of the substrate this replaced: `@/features/leaf` came back as
// `features/leaf`, where the barrel's directory is and not where any code is.
// Reverting `import-graph` to path arithmetic puts five of those back here.
//
// The barrel qualifier is not decoration. A directory with no client barrel
// genuinely resolves to nothing — `mainFiles` is the CLIENT barrel alone, so a
// feature holding only `index.server.ts` is unresolvable on purpose, and its
// target is a real directory on disk. Asserting over every directory reports
// that shape as a defect the first time the tree grows one, and the cheap fix
// for a false positive on a substrate assertion is to weaken it.
//
// The second arm is the source root itself. `..` in a target means the graph
// kept an edge that leaves this tree, and the two guards in
// `module-resolution.ts` that prevent it are the only thing that does — no
// check reports differently either way, so nothing else here would notice.
{
  const stray: string[] = [];
  for (const context of createTreeContexts(fixtureConfig, DECLARED_FIXTURE_TREES)) {
    const barrels = SOURCE_EXTENSIONS.map(
      (extension) => `${context.vocabulary.clientBarrelModule}.${extension}`,
    );
    for (const edge of context.importGraph()) {
      if (edge.target.startsWith("..")) {
        stray.push(`${edge.file} imports "${edge.specifier}", which LEAVES the tree: ${edge.target}`);
        continue;
      }
      const absolute = join(context.sourceRoot, edge.target);
      if (statSync(absolute, { throwIfNoEntry: false })?.isDirectory() !== true) continue;
      if (!barrels.some((barrel) => existsSync(join(absolute, barrel)))) continue;
      stray.push(`${edge.file} imports "${edge.specifier}" and the graph says ${edge.target}`);
    }
  }
  if (stray.length > 0) {
    fail(
      "<import-graph>",
      `${stray.length} edge target(s) name a DIRECTORY rather than a module, or a path outside ` +
        `the tree, so the graph is spelling paths rather than resolving them:\n  ` +
        `${stray.sort().join("\n  ")}`,
    );
  }
}

// ── The resolver reads the tree's vocabulary, not oxc's defaults ─────────────
//
// Two of the resolver's settings cannot be reached by any fixture in this tree,
// and both are deletable-green without what follows.
//
// `mainFiles` is the tree's CLIENT BARREL. Delete the line and oxc's own default
// is `["index"]`, which is what this tree spells its barrel — so every fixture
// passes and the setting is proved by a coincidence. A tree that renames its
// barrel is the case that separates them, and no tree here renames one.
//
// The schema arm of `boundary/layer-occupancy` compares a POSITION,
// `infrastructure/db/schema`, and this tree fills it with a directory. A project
// filling it with one `schema.ts` — the ordinary Drizzle shape — resolves to
// `infrastructure/db/schema.ts`, which is equal to nothing and under nothing
// unless the comparison strips the extension. The arm then goes silent for that
// whole repo, and every fixture here still reports.
{
  const treeRoot = join(FIXTURE_TREE, APP_TREE.root);
  const barrelNamed = (name: string) =>
    createTreeModuleResolver({ ...APP_TREE.vocabulary, clientBarrelModule: name }, treeRoot)(
      join(treeRoot, "features/billing/service/invoice-summary.ts"),
      "@/features/orders",
    );

  if (barrelNamed("index")?.resolved !== true) {
    fail("<module-resolution>", "`@/features/orders` does not resolve to this tree's barrel at all");
  }
  // The whole assertion. Under a vocabulary whose barrel is `module`, this
  // feature has none, so the directory must NOT resolve — and it does resolve if
  // `mainFiles` is left to oxc.
  if (barrelNamed("module")?.resolved === true) {
    fail(
      "<module-resolution>",
      "a tree whose barrel is `module` still resolved `@/features/orders` to a file, so " +
        "`mainFiles` is oxc's default `index` rather than the tree's own barrel name",
    );
  }

  // Same tree, same registry, one vocabulary word changed — the `PDF_TREE_MISREAD`
  // idiom. `infrastructure/db/tables.ts` is a single-module schema sitting in
  // the tree; under the default `dbSchemaSubdir` it is an ordinary
  // infrastructure module and nothing reports it, and under a vocabulary that
  // names it, `billing/controllers` reaching it past an occupied `repo/` is the
  // schema bypass. Read with the extension on, that target is equal to nothing
  // and under nothing, and the arm is silent for the whole repo.
  const singleModuleSchema = declareTrees([
    { ...APP_TREE, vocabulary: { ...APP_TREE.vocabulary, dbSchemaSubdir: "tables" } },
  ]);
  const reported = (await runStructuralChecks(structuralChecks, fixtureConfig, singleModuleSchema))
    .filter((run) => run.id === "boundary/layer-occupancy")
    .flatMap((run) => run.findings)
    .map((finding) => finding.file);
  const bypass = "harness/structural-fixtures/tree/src/features/billing/controllers/reads-single-module-schema.ts";
  if (!reported.some((file) => file.endsWith("features/billing/controllers/reads-single-module-schema.ts"))) {
    fail(
      "<module-resolution>",
      `boundary/layer-occupancy reported nothing against ${bypass} when the tree's schema is ONE ` +
        `MODULE rather than a directory, so that arm is switched off for every project with the ` +
        `ordinary single-file schema — and every fixture here still passes`,
    );
  }
}

// ── The config cannot switch a check off ─────────────────────────────────────
//
// Three values in the structural config were predicates in a name's costume:
// each one had a setting that left the check registered, running, and reporting
// nothing. They are refused at startup now, and refused is a claim that has to
// be tested — a validator nobody calls reads exactly like one that passes.
//
// The assertions run against the FIXTURE config, which is the one an adopting
// project's `arch.config.ts` is shaped like, and they call the runner rather
// than the validator so that "the runner calls it" is part of what is proved.
const refusedConfigs: { detail: string; config: ArchitectureConfig }[] = [
  {
    detail: "an empty serverFnBoundary call marks every module a server-function boundary",
    config: withCheckConfig(fixtureConfig, "api/barrel-purity", {
      serverFnBoundary: { module: "@tanstack/react-start", calls: [""] },
    }),
  },
  {
    detail: "no serverFnBoundary calls short-circuits nothing, so every feature barrel reports",
    config: withCheckConfig(fixtureConfig, "api/barrel-purity", {
      serverFnBoundary: { module: "@tanstack/react-start", calls: [] },
    }),
  },
  {
    detail: "an empty serverFnBoundary module leaves the boundary unprovable",
    config: withCheckConfig(fixtureConfig, "api/barrel-purity", {
      serverFnBoundary: { module: "", calls: ["createServerFn"] },
    }),
  },
  // The four token-equality lists are joined into a matcher, so an entry is
  // regex source. `(?!)` is a valid-looking prop list and an always-failing
  // lookahead: it took the check from four findings to zero.
  ...(["spacingProps", "radiusProps", "spacingKeys", "radiusKeys"] as const).flatMap((field) => [
    {
      detail: `an always-failing lookahead in ${field} matches nothing and reads as a prop nobody ships`,
      config: withCheckConfig(fixtureConfig, "style/token-equality", { [field]: ["(?!)"] }),
    },
    {
      detail: `an empty ${field} walks that surface for nothing`,
      config: withCheckConfig(fixtureConfig, "style/token-equality", { [field]: [] }),
    },
  ]),
  // A glob in a ROOT is the exclusion list file-size says it does not have,
  // spelled from the other side: this exact pair kept 16/16 green with most of
  // the tree no longer size-checked.
  {
    detail: "a glob in health/file-size roots narrows the walk to whatever it matches",
    config: withCheckConfig(fixtureConfig, "health/file-size", {
      roots: ["src/features/*/service", "packages/core/src"],
    }),
  },
  {
    detail: "no health/file-size roots is the exclusion list, complete",
    config: withCheckConfig(fixtureConfig, "health/file-size", { roots: [] }),
  },
  // Joined onto each feature's directory, so a traversing value points every
  // feature at one shared file and one grant authorizes its importer everywhere.
  {
    detail: "a traversing visibilityFilename turns per-feature grants into a central allowlist",
    config: withCheckConfig(fixtureConfig, "api/feature-visibility", {
      visibilityFilename: "../visibility.json",
    }),
  },
  {
    detail: "a multi-segment visibilityFilename does the same one directory down",
    config: withCheckConfig(fixtureConfig, "api/feature-visibility", {
      visibilityFilename: "grants/visibility.json",
    }),
  },
  {
    detail: "no targetLayerRoles leaves health/trampolines walking nothing",
    config: withCheckConfig(fixtureConfig, "health/trampolines", { targetLayerRoles: [] }),
  },
  {
    detail: "the repo role makes health/trampolines report the layer working",
    config: withCheckConfig(fixtureConfig, "health/trampolines", { targetLayerRoles: ["repo"] }),
  },
];

for (const { detail, config } of refusedConfigs) {
  let threw = false;
  try {
    // AWAITED, and the await is the assertion. `runStructuralChecks` is async,
    // so an unawaited call rejects rather than throws: this `catch` sees nothing,
    // `threw` stays false, and every one of these refusal cases fails — which is
    // the good outcome. The bad one is the same mistake in a check body, where
    // an unawaited call quietly returns a promise and the run counts no findings.
    await runStructuralChecks(structuralChecks, config, DECLARED_FIXTURE_TREES);
  } catch {
    threw = true;
  }
  if (!threw) fail("<config>", `accepted a config where ${detail}`);
}

// Refusing the malformed values is only half of it. `serverFnBoundary` also has
// to be UNSATISFIABLE by a word that merely appears in a file: the predecessor
// tested `raw.includes(marker)`, and a review passed the identifier "the" — which
// no validator can reject — and cut this check from four findings to one because
// three unrelated modules had it in a comment. So the assertion is behavioural:
// a valid-looking boundary that names nothing the framework exports must change
// no finding at all. It is ADDED to the real calls rather than replacing them,
// so the comparison isolates the decoy: dropping the real boundary changes the
// count on its own (4 → 5 here), which would mask the thing being tested.
{
  const decoy = withCheckConfig(fixtureConfig, "api/barrel-purity", {
    serverFnBoundary: {
      module: "@tanstack/react-start",
      calls: [...fixtureConfig.checks["api/barrel-purity"].serverFnBoundary.calls, "the"],
    },
  });
  const baseline = findingsOf(runs, "api/barrel-purity");
  const withDecoy = findingsOf(
    await runStructuralChecks(structuralChecks, decoy, DECLARED_FIXTURE_TREES),
    "api/barrel-purity",
  );
  if (baseline !== withDecoy) {
    fail(
      "<config>",
      `a serverFnBoundary naming the word "the" changed api/barrel-purity from ${baseline} ` +
        `findings to ${withDecoy} — the boundary is being recognised by the word appearing in ` +
        `a file rather than by the module being imported and the call being made`,
    );
  }
}

// A tree the type checker's program does not contain has to be LOUD, and this is
// the only assertion in the suite that can say so. Every `types/` expectation
// already fails when the program is empty — but it fails because this tree has
// fixtures, and the adopting project this guard protects has none: it would get
// zero findings, a green run, and no way to tell that from a clean tree. So the
// claim here is about the CRASH, not about the findings.
{
  const typeCheckedIds = structuralChecks
    .filter((check) => check.id.startsWith("types/"))
    .map((check) => check.id);
  if (typeCheckedIds.length === 0) {
    fail("<type-checker>", "no types/ check is registered, so nothing exercises the type checker");
  }

  const unchecked = await runStructuralChecks(
    structuralChecks,
    fixtureConfig,
    APP_TREE_TYPE_UNCHECKED,
  );
  for (const id of typeCheckedIds) {
    const run = unchecked.find((candidate) => candidate.id === id);
    const crashed = run?.crashed;
    if (crashed === undefined) {
      fail(
        id,
        `ran against a tsconfig that compiles none of the tree and reported ` +
          `${run?.findings.length ?? 0} finding(s) without complaint — a tree the program does ` +
          `not contain must fail loudly, because zero findings there is indistinguishable ` +
          `from a clean tree`,
      );
      continue;
    }
    // The wording is asserted because the verdict cannot distinguish this crash
    // from any other. A check that threw for an unrelated reason satisfies
    // "crashed" and proves nothing about the guard.
    if (!crashed.message.includes("not in the program that config builds")) {
      fail(id, `crashed on a type-unchecked tree, but not from the guard: ${crashed.message}`);
    }
  }
}

function findingsOf(checkRuns: CheckRun[], id: string): number {
  return checkRuns
    .filter((run) => run.id === id)
    .reduce((total, run) => total + run.findings.length, 0);
}

function withCheckConfig<Id extends keyof ArchitectureConfig["checks"]>(
  base: ArchitectureConfig,
  id: Id,
  overrides: Partial<ArchitectureConfig["checks"][Id]>,
): ArchitectureConfig {
  return {
    ...base,
    checks: { ...base.checks, [id]: { ...base.checks[id], ...overrides } },
  };
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
 * that never happened: merging by id ERASES the tree identity, and a check
 * skipped on the second tree merges to exactly what it would produce if it had
 * run there and found nothing. `assertEveryCheckRanOnEveryTree` is what makes
 * that visible, and it runs before this is called.
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
// NOT a copy of run-rule-fixtures.ts's `checkTreeScoping`, which landed in the
// same change and is the same size. That one parses the shipped
// `setup/oxlintrc.json` and asserts its override globs name the declared roots;
// it runs no check. This one runs the whole structural tier twice over one
// fixture tree and asserts what changes when a root is declared. The shared
// subject is "declared trees"; there is no shared logic under it.
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
//
// BOTH directions, and the positive one is the load-bearing half. The negative
// alone — "nothing reported under capabilities/" — passes unchanged if the
// fixture under it is renamed or deleted, which is how this guard was
// deletable-green: a silent stop-matching reports nothing and reads as a pass.
const CAPABILITIES_PREFIX = `${PDF_TREE.root}/capabilities/`;

const wrongVocabulary = firesOnceDeclared.filter((entry) => entry.includes(CAPABILITIES_PREFIX));
if (wrongVocabulary.length > 0) {
  fail(
    "<declared-trees>",
    `a declared tree was read with another tree's vocabulary:\n` +
      `        ${wrongVocabulary.join("\n        ")}`,
  );
}

const misreadFindings = findingsUnder(misread, CAPABILITIES_PREFIX);
if (misreadFindings.length === 0) {
  fail(
    "<declared-trees>",
    `the vocabulary assertion has nothing to read: declaring ${PDF_TREE.root} with the WRONG ` +
      `vocabulary produced no finding under ${CAPABILITIES_PREFIX}, so the fixture that proves ` +
      `the right vocabulary works is missing and the assertion above passes vacuously`,
  );
}

// Declaring a second tree must not change the first tree's verdicts.
//
// What this can actually catch is SHARED MUTABLE STATE between tree contexts —
// a memo, a cache, or a set hoisted to module scope that one tree's walk fills
// and the next tree's walk reads. The contexts are built per call and each
// carries its own memos, so this passes today for a real reason rather than by
// construction; it is here because the failure it names is silent, tempting
// (memoising the import graph across trees is an obvious optimisation), and
// would show up as one tree's findings appearing under another's.
//
// It is NOT what catches a tree going silent. `runs` feeds the whole 16-check
// comparison below, so a silenced app tree fails there sixteen times over.
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
