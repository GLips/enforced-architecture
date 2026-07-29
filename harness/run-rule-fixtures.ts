/**
 * Proves every GritQL rule template in the skill catches what its header claims.
 *
 * A rule's failure mode is silent by construction: when it stops matching it
 * goes green, not red. Reading a rule does not catch this, because the reader
 * shares the author's blind spot. Only running the rule against a case built to
 * beat it works. That is what this harness does, and it runs in CI so a
 * template edit that breaks a rule fails the pull request.
 *
 * The templates are run UNMODIFIED as Biome plugins — there is no second copy
 * of any rule, so there is nothing to drift. See harness/README.md for why that
 * is possible and what it costs.
 */

import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, relative, resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dir, "..");
const RULES_ROOT = join(REPO_ROOT, "skills/enforced-architecture/references/rules");
const FIXTURES_ROOT = join(import.meta.dir, "fixtures");
const BIOME_BIN = join(REPO_ROOT, "node_modules/.bin/biome");

/** Extensions Biome will lint. A fixture with any other extension is invisible to the run. */
const LINTABLE = /\.(?:[cm]?[tj]sx?|css)$/;

/**
 * Each rule must prove all three, and the harness refuses a set that is missing
 * one. Positive-only fixtures cannot see over-matching, which is the defect that
 * trains people to ignore a rule; a single obvious violation cannot see the
 * spelling the rule's natural pattern misses, which is the defect that leaves an
 * invariant ungoverned behind a green check.
 *
 * The kind is the first path segment under the rule's fixture directory, not a
 * filename prefix: several rules match an exact filename (`index.ts`,
 * `theme.ts`) and could not carry a prefix. Everything below that segment is a
 * real source tree, because the rules read the path.
 */
const CASE_KINDS = ["obvious", "adversarial", "legal"] as const;
type CaseKind = (typeof CASE_KINDS)[number];

/**
 * `// EXPECT: why` expects one diagnostic on the following line.
 * `// EXPECT+3: why` expects one three lines below the marker — for statements
 * whose reported span (the module source, the JSX attribute) is not on the line
 * the statement starts on.
 */
const EXPECT_MARKER = /^\s*(?:\/\/|\/\*)\s*EXPECT(?:\+(\d+))?\s*:/;

/** A blank or comment-only line can never carry a diagnostic, so a marker aimed
 * at one is always an authoring slip — most often a `why` note that wrapped. */
const NON_CODE_LINE = /^\s*(?:\/\/.*)?$/;

type ExpectedDiagnostic = { file: string; line: number; why: string; targetsCode: boolean };

type BiomeDiagnostic = {
  severity: string;
  message: string;
  category: string;
  location: { path?: string; start?: { line: number } };
};

type RuleFailure = { rule: string; detail: string };

async function walkFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => null);
  if (entries === null) return [];
  const found: string[] = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await walkFiles(path)));
    else found.push(path);
  }
  return found;
}

function caseKindOf(fixtureDir: string, path: string): CaseKind | null {
  const segment = relative(fixtureDir, path).split("/")[0];
  return CASE_KINDS.find((kind) => kind === segment) ?? null;
}

async function readExpectedDiagnostics(file: string): Promise<ExpectedDiagnostic[]> {
  const lines = (await Bun.file(file).text()).split("\n");
  const expected: ExpectedDiagnostic[] = [];
  lines.forEach((text, index) => {
    const marker = EXPECT_MARKER.exec(text);
    if (marker === null) return;
    const offset = marker[1] === undefined ? 1 : Number(marker[1]);
    const line = index + 1 + offset;
    expected.push({
      file,
      line,
      why: text.slice(marker[0].length).trim(),
      targetsCode: !NON_CODE_LINE.test(lines[line - 1] ?? ""),
    });
  });
  return expected;
}

/**
 * One plugin per Biome run. Biome reports every plugin diagnostic under the
 * single category "plugin" with no rule name attached, so loading two plugins at
 * once makes it impossible to say which one fired — and a rule that fires for
 * the wrong reason is exactly what this harness exists to catch.
 */
async function writeIsolatedBiomeConfig(dir: string, gritPath: string): Promise<void> {
  await writeFile(
    join(dir, "biome.json"),
    JSON.stringify({
      plugins: [gritPath],
      linter: { enabled: true, rules: { recommended: false } },
      formatter: { enabled: false },
      assist: { enabled: false },
      files: { includes: ["**"] },
      // Fixtures are deliberately illegal code and may be gitignored in a
      // consuming checkout; VCS-aware scanning would skip them.
      vcs: { enabled: false },
    }),
    "utf8",
  );
}

type LintOutcome =
  | { ok: true; diagnostics: BiomeDiagnostic[] }
  | { ok: false; loadError: string };

async function lintFixtures(gritPath: string, fixtureDir: string): Promise<LintOutcome> {
  const configDir = await mkdtemp(join(tmpdir(), "ea-rule-"));
  try {
    await writeIsolatedBiomeConfig(configDir, gritPath);
    const run = Bun.spawn(
      [BIOME_BIN, "lint", `--config-path=${configDir}`, "--reporter=json", fixtureDir],
      { stdout: "pipe", stderr: "pipe" },
    );
    const [stdout, stderr] = await Promise.all([
      new Response(run.stdout).text(),
      new Response(run.stderr).text(),
    ]);
    await run.exited;

    // A plugin that fails to COMPILE (a `#` comment, a snake_case node name)
    // aborts the run before any JSON is written. Biome still exits before
    // linting anything, so there is no diagnostic to miss — only silence.
    const json = stdout.slice(stdout.indexOf("{"));
    if (json === "") {
      return { ok: false, loadError: stderr.trim() || "Biome produced no output" };
    }
    return { ok: true, diagnostics: JSON.parse(json).diagnostics ?? [] };
  } finally {
    await rm(configDir, { recursive: true, force: true });
  }
}

/**
 * A plugin that compiles but fails at RUNTIME — the regex-capture-group trap is
 * the common one — is reported at severity `info`, so the build stays green and
 * the rule reports nothing forever. This is the exact failure the harness was
 * built for, so it gets its own detection rather than surfacing as "every
 * expected diagnostic is missing".
 */
function findRuntimeLoadError(diagnostics: BiomeDiagnostic[]): string | null {
  const errored = diagnostics.find((d) => / errored: /.test(d.message));
  return errored?.message ?? null;
}

function describeLocation(diagnostic: BiomeDiagnostic): string {
  const path = diagnostic.location.path ?? "<unknown>";
  return `${relative(FIXTURES_ROOT, path)}:${diagnostic.location.start?.line ?? 0}`;
}

async function checkRule(gritPath: string): Promise<RuleFailure[]> {
  const ruleId = relative(RULES_ROOT, gritPath).replace(/\.grit$/, "");
  const fail = (detail: string): RuleFailure[] => [{ rule: ruleId, detail }];

  const fixtureDir = join(FIXTURES_ROOT, ruleId);
  const fixtureFiles = (await walkFiles(fixtureDir)).filter((f) => LINTABLE.test(f));
  if (fixtureFiles.length === 0) {
    return fail(`no fixtures at harness/fixtures/${ruleId}/`);
  }

  const failures: RuleFailure[] = [];
  for (const file of fixtureFiles.filter((f) => caseKindOf(fixtureDir, f) === null)) {
    failures.push({
      rule: ruleId,
      detail: `fixture ${relative(fixtureDir, file)} sits under no obvious/, adversarial/, or legal/ directory`,
    });
  }
  for (const kind of CASE_KINDS) {
    if (!fixtureFiles.some((f) => caseKindOf(fixtureDir, f) === kind)) {
      failures.push({ rule: ruleId, detail: `missing the ${kind} case` });
    }
  }

  const expected: ExpectedDiagnostic[] = [];
  const markerCount: Record<CaseKind, number> = { obvious: 0, adversarial: 0, legal: 0 };
  for (const file of fixtureFiles) {
    const markers = await readExpectedDiagnostics(file);
    const kind = caseKindOf(fixtureDir, file);
    if (kind !== null) markerCount[kind] += markers.length;
    if (kind === "legal" && markers.length > 0) {
      failures.push({
        rule: ruleId,
        detail: `${relative(fixtureDir, file)} is a legal-neighbour fixture but carries EXPECT markers`,
      });
    }
    for (const marker of markers.filter((m) => !m.targetsCode)) {
      failures.push({
        rule: ruleId,
        detail: `${relative(fixtureDir, file)}:${marker.line} is blank or comment-only, so the EXPECT marker above it cannot be right — keep the note on one line`,
      });
    }
    expected.push(...markers);
  }
  // A violation fixture with no marker asserts nothing, and would pass whether
  // or not the rule ever fired.
  for (const kind of ["obvious", "adversarial"] as const) {
    if (markerCount[kind] === 0) {
      failures.push({ rule: ruleId, detail: `the ${kind} case carries no EXPECT marker, so it asserts nothing` });
    }
  }
  if (failures.length > 0) return failures;

  const outcome = await lintFixtures(gritPath, fixtureDir);
  if (!outcome.ok) {
    return fail(`the rule failed to compile, so it would silently report nothing:\n      ${outcome.loadError.replace(/\n/g, "\n      ")}`);
  }
  const runtimeLoadError = findRuntimeLoadError(outcome.diagnostics);
  if (runtimeLoadError !== null) {
    return fail(`the rule failed to load at runtime (Biome reports this as 'info', so a build stays green): ${runtimeLoadError}`);
  }

  // Anything Biome reports that is not the plugin means the fixture itself is
  // broken — a syntax error, or a file Biome could not read.
  for (const foreign of outcome.diagnostics.filter((d) => d.category !== "plugin")) {
    failures.push({
      rule: ruleId,
      detail: `fixture problem at ${describeLocation(foreign)}: ${foreign.message}`,
    });
  }

  const actual = outcome.diagnostics
    .filter((d) => d.category === "plugin")
    .map((d) => ({ key: describeLocation(d), diagnostic: d }));
  const expectedKeys = expected.map((e) => ({
    key: `${relative(FIXTURES_ROOT, e.file)}:${e.line}`,
    why: e.why,
  }));

  const actualKeys = actual.map((a) => a.key);
  const remaining = [...actualKeys];
  for (const { key, why } of expectedKeys) {
    const at = remaining.indexOf(key);
    if (at === -1) {
      failures.push({
        rule: ruleId,
        detail: `UNDER-MATCHED — no diagnostic at ${key}, which should have been caught: ${why}`,
      });
    } else remaining.splice(at, 1);
  }
  for (const key of remaining) {
    failures.push({
      rule: ruleId,
      detail: `OVER-MATCHED — unexpected diagnostic at ${key}, which is legal code`,
    });
  }

  return failures;
}

const gritPaths = (await walkFiles(RULES_ROOT)).filter((f) => f.endsWith(".grit")).sort();
if (gritPaths.length === 0) {
  console.error(`No .grit templates found under ${RULES_ROOT}`);
  process.exit(1);
}
const ruleIds = gritPaths.map((p) => relative(RULES_ROOT, p).replace(/\.grit$/, ""));

const results = await Promise.all(gritPaths.map(checkRule));

let failedRules = 0;
ruleIds.forEach((ruleId, index) => {
  const failures = results[index] ?? [];
  if (failures.length === 0) {
    console.log(`  PASS  ${ruleId}`);
    return;
  }
  failedRules += 1;
  console.log(`  FAIL  ${ruleId}`);
  for (const { detail } of failures) console.log(`        ${detail}`);
});

// A fixture under no rule's directory is a fixture nothing runs. Renaming a
// template without moving its fixtures would otherwise read as full coverage.
const orphans = (await walkFiles(FIXTURES_ROOT))
  .filter((f) => LINTABLE.test(f))
  .map((f) => relative(FIXTURES_ROOT, f))
  .filter((f) => !ruleIds.some((id) => f.startsWith(`${id}/`)));
for (const orphan of orphans) {
  console.log(`  FAIL  <orphan> ${orphan} belongs to no rule template`);
}

console.log(
  `\n${ruleIds.length - failedRules}/${ruleIds.length} GritQL rule templates proved against their fixtures.`,
);
process.exit(failedRules === 0 && orphans.length === 0 ? 0 : 1);
