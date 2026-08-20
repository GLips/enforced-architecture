/**
 * Proves every oxlint rule template in the skill catches what its header claims.
 *
 * A rule's failure mode is silent by construction: when it stops matching it
 * goes green, not red. Reading a rule does not catch this, because the reader
 * shares the author's blind spot. Only running the rule against a case built to
 * beat it works. That is what this harness does, and it runs in CI so a
 * template edit that breaks a rule fails the pull request.
 *
 * The templates are run UNMODIFIED — the spec beside each rule imports the
 * shipped file, so there is no second copy of any rule and nothing to drift.
 * See harness/README.md for what that costs.
 *
 * Two things the specs cannot check about themselves, and this runner does:
 * a rule with no spec at all, and a spec that has been stubbed or aimed at the
 * wrong rule. Both leave a green run behind a rule nothing exercises.
 */

import { spawnSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HARNESS_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HARNESS_DIR, "..");
/**
 * The oxlint tier is a directory, not a filter. Every `.ts` under this root is either a rule, a
 * rule's spec, or shared helpers in `lib/` — the whole-tree tier lives in a sibling directory with
 * its own harness (`harness/run-structural-fixtures.ts`), so nothing here has to ask which tier a file
 * belongs to.
 */
const OXLINT_ROOT = join(REPO_ROOT, "skills/enforced-architecture/references/lint/oxlint");
const PLUGIN_PATH = join(OXLINT_ROOT, "plugin.ts");

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

const allFiles = await walkFiles(OXLINT_ROOT);
const ruleIdOf = (path: string) => relative(OXLINT_ROOT, path).replace(/\.ts$/, "");

const tsFiles = allFiles.filter(
  // `lib/` is the shared helpers these rules import. It holds no rules, and would otherwise read
  // as a folder of templates with no specs.
  (f) => f.endsWith(".ts") && !f.startsWith(join(OXLINT_ROOT, "lib")) && f !== PLUGIN_PATH,
);
const specPaths = new Set(tsFiles.filter((f) => f.endsWith(".test.ts")));
const rulePaths = tsFiles.filter((f) => !f.endsWith(".test.ts")).sort();

if (rulePaths.length === 0) {
  console.error(`No rule templates found under ${OXLINT_ROOT}`);
  process.exit(1);
}

/**
 * Load the manifest rather than grep it. A commented-out registration, a rule bound to the wrong
 * export, or a plugin that does not load at all are each invisible to a text search — and a plugin
 * that fails to load takes every rule in the catalog silent with it, which is the single largest
 * version of the failure this harness exists to catch.
 */
const plugin = await import(PLUGIN_PATH)
  .then((module) => module.default)
  .catch((error: Error) => error);
if (plugin instanceof Error) {
  console.log(`  FAIL  <plugin> oxlint/plugin.ts does not load, so every rule is silent:`);
  console.log(`        ${plugin.message.replace(/\n/g, "\n        ")}`);
  process.exit(1);
}
const registered: Record<string, unknown> = plugin.rules ?? {};

async function checkRule(rulePath: string): Promise<RuleFailure[]> {
  const ruleId = ruleIdOf(rulePath);
  const name = basename(rulePath, ".ts");
  const failures: RuleFailure[] = [];
  const fail = (detail: string) => failures.push({ rule: ruleId, detail });

  // `describeRule` rejects an empty case list at load time, so the spec checks here are the two it
  // cannot make about itself: that the spec exists, and that it is aimed at the rule beside it.
  const specPath = rulePath.replace(/\.ts$/, ".test.ts");
  if (!specPaths.has(specPath)) {
    fail(`no spec at ${relative(REPO_ROOT, specPath)}, so nothing exercises this rule`);
  } else {
    const spec = await readFile(specPath, "utf8");
    // Whitespace-tolerant: a long rule id pushes the call onto its own line under any formatter.
    if (!new RegExp(String.raw`describeRule\(\s*"${ruleId}"`).test(spec)) {
      fail(`its spec does not call describeRule("${ruleId}", …), so the three-kind contract is unproven`);
    }
    if (!spec.includes(`from "./${name}.ts"`)) {
      fail(`its spec does not import ./${name}.ts, so it may be proving a different rule`);
    }
  }

  // The plugin module is the manifest a consuming project copies. A rule missing from it ships as a
  // file nobody loads — tested, and never run.
  const bound = registered[name];
  const exported = await import(rulePath).then((module) => Object.values(module));
  if (bound === undefined) {
    fail(`not registered in oxlint/plugin.ts under the key "${name}"`);
  } else if (!exported.includes(bound)) {
    fail(`oxlint/plugin.ts binds the key "${name}" to a rule this file does not export`);
  }

  return failures;
}

const structural = await Promise.all(rulePaths.map(checkRule));

// Run every spec in one Node process — `node --test` gives each file its own subprocess.
const specList = rulePaths.map((p) => p.replace(/\.ts$/, ".test.ts")).filter((p) => specPaths.has(p));
const run = spawnSync(process.execPath, ["--test", "--test-reporter=tap", ...specList], {
  cwd: REPO_ROOT,
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
});
const tap = `${run.stdout ?? ""}${run.stderr ?? ""}`;

/**
 * Attribution reads the TAP result NAMES rather than the file results, because `describeRule` makes
 * every kind announce itself as `<rule id> (<kind>)`. That turns "did this kind run at all?" into a
 * question the output can answer — and a kind that never ran is the failure worth catching. A spec
 * that throws while loading reports no name, so its three kinds are simply absent, and a stubbed or
 * deleted check cannot leave its expectations passing on zero cases.
 */
const KINDS = ["obvious", "adversarial", "legal"] as const;
const outcomeByKind = new Map<string, "ok" | "not ok">();
for (const line of tap.split("\n")) {
  const result = /^\s*(not ok|ok) \d+ - (.+) \((obvious|adversarial|legal)\)$/.exec(line);
  if (result !== null) outcomeByKind.set(`${result[2]}|${result[3]}`, result[1] as "ok" | "not ok");
}

let failedRules = 0;
rulePaths.forEach((rulePath, index) => {
  const ruleId = ruleIdOf(rulePath);
  const failures = [...(structural[index] ?? [])];
  for (const kind of KINDS) {
    const outcome = outcomeByKind.get(`${ruleId}|${kind}`);
    if (outcome === undefined) {
      failures.push({ rule: ruleId, detail: `the ${kind} specs never ran — see the report below` });
    } else if (outcome === "not ok") {
      failures.push({ rule: ruleId, detail: `the ${kind} specs failed — see the report below` });
    }
  }

  if (failures.length === 0) {
    console.log(`  PASS  ${ruleId}`);
    return;
  }
  failedRules += 1;
  console.log(`  FAIL  ${ruleId}`);
  for (const { detail } of failures) console.log(`        ${detail}`);
});

// A spec under no rule's name is a spec nothing claims. Renaming a template without renaming its
// spec would otherwise read as full coverage.
const orphans = [...specPaths]
  .filter((spec) => !rulePaths.includes(spec.replace(/\.test\.ts$/, ".ts")))
  .map((spec) => relative(OXLINT_ROOT, spec));
for (const orphan of orphans) {
  console.log(`  FAIL  <orphan> ${orphan} sits beside no rule template`);
}

if (run.status !== 0) console.log(`\n${tap}`);

console.log(
  `\n${rulePaths.length - failedRules}/${rulePaths.length} oxlint rule templates proved against their obvious / adversarial / legal specs.`,
);
process.exit(failedRules === 0 && orphans.length === 0 && run.status === 0 ? 0 : 1);
