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
const RULES_ROOT = join(REPO_ROOT, "skills/enforced-architecture/references/rules");
const PLUGIN_PATH = join(RULES_ROOT, "plugin.ts");

/**
 * Cross-file checks that run pre-commit rather than per-file in the editor: they count across a
 * file set or resolve imports against the tree, which no per-file rule can answer. They ship as an
 * algorithm in a sibling `.md`, are not oxlint rules, and have their own harness. Listing them by
 * name rather than inferring the distinction keeps a new script template from silently counting as
 * an untested oxlint rule.
 */
const SCRIPT_TIER = new Set(["api/feature-visibility"]);

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

const allFiles = await walkFiles(RULES_ROOT);
const ruleIdOf = (path: string) => relative(RULES_ROOT, path).replace(/\.ts$/, "");

const tsFiles = allFiles.filter(
  (f) => f.endsWith(".ts") && !f.startsWith(join(RULES_ROOT, "lib")) && f !== PLUGIN_PATH,
);
const specPaths = new Set(tsFiles.filter((f) => f.endsWith(".test.ts")));
const rulePaths = tsFiles
  .filter((f) => !f.endsWith(".test.ts") && !SCRIPT_TIER.has(ruleIdOf(f)))
  .sort();

if (rulePaths.length === 0) {
  console.error(`No rule templates found under ${RULES_ROOT}`);
  process.exit(1);
}

const pluginSource = await readFile(PLUGIN_PATH, "utf8");

/**
 * A spec is only evidence if it runs THIS rule and actually carries cases. `describeRule` rejects
 * an empty case list at load time, so the checks here are the two it cannot make about itself:
 * that the spec exists, and that it is pointed at the rule it sits beside.
 */
async function checkRule(rulePath: string): Promise<RuleFailure[]> {
  const ruleId = ruleIdOf(rulePath);
  const name = basename(rulePath, ".ts");
  const failures: RuleFailure[] = [];
  const fail = (detail: string) => failures.push({ rule: ruleId, detail });

  const specPath = rulePath.replace(/\.ts$/, ".test.ts");
  if (!specPaths.has(specPath)) {
    fail(`no spec at ${relative(REPO_ROOT, specPath)}, so nothing exercises this rule`);
  } else {
    const spec = await readFile(specPath, "utf8");
    if (!spec.includes(`describeRule("${ruleId}"`)) {
      fail(`its spec does not call describeRule("${ruleId}", …), so the three-kind contract is unproven`);
    }
    if (!spec.includes(`from "./${name}.ts"`)) {
      fail(`its spec does not import ./${name}.ts, so it may be proving a different rule`);
    }
  }

  // The plugin file is the manifest a consuming project copies. A rule missing from it ships as a
  // file nobody loads — tested, and never run.
  if (!pluginSource.includes(`"${name}":`)) {
    fail(`not registered in rules/plugin.ts under the key "${name}"`);
  }
  if (!pluginSource.includes(`from "./${relative(RULES_ROOT, rulePath)}"`)) {
    fail(`rules/plugin.ts does not import ./${relative(RULES_ROOT, rulePath)}`);
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
  .map((spec) => relative(RULES_ROOT, spec));
for (const orphan of orphans) {
  console.log(`  FAIL  <orphan> ${orphan} sits beside no rule template`);
}

if (run.status !== 0) console.log(`\n${tap}`);

console.log(
  `\n${rulePaths.length - failedRules}/${rulePaths.length} oxlint rule templates proved against their obvious / adversarial / legal specs.`,
);
process.exit(failedRules === 0 && orphans.length === 0 && run.status === 0 ? 0 : 1);
