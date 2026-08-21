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
 *
 * It also runs the specs beside `lint/policy/`. That directory holds no rules —
 * it holds the tables both tiers read — so its specs get no three-kind
 * attribution and no plugin registration check. They run here rather than under
 * Bun because the tier that reads them from a Node process is this one, and a
 * table proved in one runtime and consumed in two is a table proved once.
 */

import { spawnSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isTreeScopedRule } from "../skills/enforced-architecture/references/lint/oxlint/lib/define-tree-rule.ts";

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
/**
 * The runtime-neutral tables below both tiers. Its specs are collected and run,
 * and nothing else about it is asserted: it has no registry to compare against
 * and no per-module spec requirement, because one spec covering the engine and
 * the vocabulary it reads is the right shape rather than an omission.
 */
const POLICY_ROOT = join(REPO_ROOT, "skills/enforced-architecture/references/lint/policy");
/**
 * The shipped oxlint config. Read here for ONE claim: that the trees it scopes
 * the `arch/` rules to are the trees `policy/declared-trees.ts` declares.
 * Declaration and scoping are one list wearing two hats, and a root in one and
 * not the other is a tree that reads as governed and is not.
 */
const OXLINTRC_PATH = join(REPO_ROOT, "skills/enforced-architecture/references/setup/oxlintrc.json");
const LEFTHOOK_PATH = join(REPO_ROOT, "skills/enforced-architecture/references/setup/lefthook.yml");

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

const policyFiles = await walkFiles(POLICY_ROOT);
const policySpecs = policyFiles.filter((f) => f.endsWith(".test.ts")).sort();
const policyModules = policyFiles.filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));
// A policy module is read by BOTH tiers, so it going unexercised is worse than a
// rule going unexercised, not better. There is no per-module requirement — the
// engine and the vocabulary are proved through one entry point — but a policy
// directory with modules and no specs at all is a hole with nothing to name it.
if (policyModules.length > 0 && policySpecs.length === 0) {
  console.error(`No specs found under ${POLICY_ROOT}, so nothing exercises the shared tables`);
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

  // The header is the ONLY documentation that reaches the project this rule is copied into, so a
  // rule that never says what it buys arrives there as a matcher with no stated purpose. Presence
  // only — no gate can tell a concrete claim from abstract praise, and a green tick on that would
  // defeat the format it is checking.
  if (!statesWhatItBuys(await readFile(rulePath, "utf8"))) {
    fail(
      `its header opens with no "Makes sure:" (blocking) or "Shows:" (warning) line, ` +
        `so nothing says what the rule buys`,
    );
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
const configFailures = [...(await checkTreeScoping()), ...(await checkCommitGateExtensions())];

// Run every spec in one Node process — `node --test` gives each file its own subprocess.
const specList = [
  ...rulePaths.map((p) => p.replace(/\.ts$/, ".test.ts")).filter((p) => specPaths.has(p)),
  ...policySpecs,
];
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
for (const detail of configFailures) {
  console.log(`  FAIL  <config> ${detail}`);
}

if (run.status !== 0) console.log(`\n${tap}`);

console.log(
  `\n${rulePaths.length - failedRules}/${rulePaths.length} oxlint rule templates proved against their obvious / adversarial / legal specs,` +
    ` plus ${policySpecs.length} spec file(s) over the shared tables in lint/policy/.`,
);
process.exit(
  failedRules === 0 && orphans.length === 0 && configFailures.length === 0 && run.status === 0
    ? 0
    : 1,
);

/**
 * Whether a rule's banner states what the rule buys, rather than what it matches. `Makes sure:`
 * claims a property the codebase can rely on and belongs to a blocking rule; `Shows:` reports
 * something a reader learns and belongs to a warning. The label carries the blocking status, which
 * is why no separate field states it.
 */
function statesWhatItBuys(source: string): boolean {
  const lines = source.split("\n");
  const end = lines.findIndex((line) => !line.startsWith("//"));
  return lines
    .slice(0, end === -1 ? lines.length : end)
    .some((line) => /^\/\/ (Makes sure|Shows):/.test(line));
}

/**
 * Strip `//` comments so `JSON.parse` can read the shipped JSONC config.
 *
 * String-aware rather than a regex, because `"arch/db-isolation"` is a key with
 * a slash in it and a naive cut would truncate the object at the first one. Block
 * comments are not handled: the config uses none, and a stripper that quietly
 * accepted a form the file never takes would be untested code.
 */
function stripLineComments(source: string): string {
  let out = "";
  let inString = false;
  let escaped = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (inString) {
      out += character;
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') {
      inString = true;
      out += character;
      continue;
    }
    if (character === "/" && source[index + 1] === "/") {
      while (index < source.length && source[index] !== "\n") index += 1;
      out += "\n";
      continue;
    }
    out += character;
  }
  return out;
}

/**
 * The tree-scoping guard: the shipped config's `arch/` scope equals the declared
 * tree list, one `<root>/**` glob per root.
 *
 * NOT a copy of run-structural-fixtures.ts's two-tree probe, which landed in the
 * same change and is the same size. That one runs the checks twice and asserts
 * what DECLARING a tree does to the findings; this one never runs a rule, and
 * asserts that the shipped config's globs name the same roots the policy module
 * declares. Different tier, different artifact, no overlapping line — and no
 * shared helper to extract, because the only thing they have in common is the
 * word "tree".
 *
 * This is the only thing here that reads the config file, and it deliberately
 * says nothing about severities — see the note in the config itself. What it
 * catches is the divergence that produces a silently unpoliced tree: a project
 * declaring `packages/core/src` and never widening the glob gets a tree every
 * rule resolves and oxlint never runs them over, and a project widening the glob
 * without declaring the root gets rules that load and return early on every file.
 * Both read as green.
 *
 * WHICH BLOCK each rule belongs in is also asserted, and read off the loaded
 * rule objects rather than listed: a rule built with `defineTreeRule` carries
 * the tree gate and is tree-scoped, one built with plain `defineRule` does not
 * and is global. `testing/no-module-mocking` is
 * the only rule in the second group — its subject is tests, which
 * `classifyFileRole` deliberately reports as no subject at all — and putting it
 * behind a tree glob silently stops it reporting on every suite outside a
 * declared tree, including the repo-root `test/` directory this catalog treats
 * as a first-class convention. A curated exception list would drift; reading the
 * rule source cannot, because the same line that makes a rule tree-dependent is
 * the line the guard looks for.
 *
 * NEGATIVE SPACE: this asks WHICH block a rule is in, never whether it is in one
 * at all. A rule enabled nowhere is the separate registration-versus-enablement
 * defect, and the config records one deliberate instance of it — the HELD BACK
 * note on `arch/no-reflect-access`, which cannot fire under a real global scope
 * and is tracked by ea-48. Asserting existence here would make this guard the
 * second owner of that question and would fail on a hold it has no opinion
 * about.
 */
async function checkTreeScoping(): Promise<string[]> {
  const { DECLARED_TREES } = (await import(join(POLICY_ROOT, "declared-trees.ts"))) as {
    DECLARED_TREES: { root: string; vocabulary: { generatedDir: string } }[];
  };
  const config = JSON.parse(stripLineComments(await readFile(OXLINTRC_PATH, "utf8"))) as {
    rules?: Record<string, unknown>;
    ignorePatterns?: string[];
    overrides?: { files?: string[]; excludeFiles?: string[]; rules?: Record<string, unknown> }[];
  };

  const failures: string[] = [];

  // A rule is tree-dependent when the object the PLUGIN REGISTERS was built with
  // `defineTreeRule`, which is the same act that gives it the gate — so this
  // cannot disagree with what the rule actually does.
  //
  // Two things this deliberately does not do, each because a review defeated the
  // version that did. It does not read the rule's SOURCE: a grep for
  // `classifyFileRole` proves an identifier is present, not that it controls
  // execution, and a rule whose gate is deleted with its import left behind
  // passes that grep with every spec green. And it does not ask whether the
  // module exports SOMETHING tree-scoped: a file can export a gated decoy beside
  // the ungated rule the plugin actually loads. The registered object is the one
  // oxlint runs, so it is the only one whose scope means anything.
  const treeDependent = new Set<string>();
  for (const rulePath of rulePaths) {
    const name = basename(rulePath, ".ts");
    // `arch/<basename>` is the key the plugin registers and the config spells —
    // NOT the `<category>/<name>` path `ruleIdOf` gives.
    if (isTreeScopedRule(registered[name])) treeDependent.add(`arch/${name}`);
  }

  // `ignorePatterns` is the third place this file could spell a tree root, and
  // it is derived from the same list as the rest: one glob per declared tree,
  // naming that tree's generated directory. An entry no tree implies is either a
  // stale root or a hand-written exemption, and both read as coverage.
  const expectedIgnores = DECLARED_TREES.map(
    (tree) => `${tree.root}/${tree.vocabulary.generatedDir}/**`,
  ).sort();
  const actualIgnores = [...(config.ignorePatterns ?? [])].sort();
  if (expectedIgnores.join("|") !== actualIgnores.join("|")) {
    failures.push(
      `setup/oxlintrc.json's ignorePatterns is [${actualIgnores.join(", ")}], but the declared ` +
        `trees and their generatedDir imply [${expectedIgnores.join(", ")}] — a hand-written ` +
        `entry is an exemption nothing declared, and a missing one lints generated output`,
    );
  }

  const globalArchKeys = Object.keys(config.rules ?? {}).filter((key) => key.startsWith("arch/"));
  const misplacedGlobal = globalArchKeys.filter((key) => treeDependent.has(key));
  if (misplacedGlobal.length > 0) {
    failures.push(
      `setup/oxlintrc.json enables ${misplacedGlobal.join(", ")} outside any tree-scoped override, ` +
        `so those rules are loaded for files no declared tree owns and return early on all of them`,
    );
  }

  const scopedEntries = (config.overrides ?? []).filter((entry) =>
    Object.keys(entry.rules ?? {}).some((key) => key.startsWith("arch/")),
  );

  // `excludeFiles` subtracts from the glob the pairs below are built out of, and
  // it is invisible to every one of them: the matrix compares `files` against the
  // declared roots, so an override that names `<root>/**` and then excludes
  // `<root>/features/**` produces exactly the pairs the matrix expects while
  // oxlint runs no architecture rule inside a governed position. There is no
  // legitimate value — a tree the project does not want policed is a tree it does
  // not declare — so any nonempty one is refused rather than compared.
  const excluding = scopedEntries.filter((entry) => (entry.excludeFiles ?? []).length > 0);
  if (excluding.length > 0) {
    failures.push(
      `setup/oxlintrc.json gives an arch/ override an excludeFiles of ` +
        `[${(excluding[0]?.excludeFiles ?? []).join(", ")}], which carves a hole inside a declared ` +
        `tree that the rule/tree matrix cannot see — every pairing still reads as scoped. A tree ` +
        `that should not be policed is a tree policy/declared-trees.ts should not declare`,
    );
  }

  const scopedArchKeys = scopedEntries.flatMap((entry) =>
    Object.keys(entry.rules ?? {}).filter((key) => key.startsWith("arch/")),
  );
  const misplacedScoped = scopedArchKeys.filter((key) => !treeDependent.has(key));
  if (misplacedScoped.length > 0) {
    failures.push(
      `setup/oxlintrc.json scopes ${misplacedScoped.join(", ")} to the declared trees, but ` +
        `${misplacedScoped.length === 1 ? "that rule reads" : "those rules read"} no tree — so the ` +
        `glob is the only thing bounding ${misplacedScoped.length === 1 ? "it" : "them"}, and every ` +
        `file outside a declared tree goes unreported with nothing saying so. Enable ` +
        `${misplacedScoped.length === 1 ? "it" : "them"} in the global "rules" block`,
    );
  }

  // The exact (rule, tree root) MATRIX, not two unions.
  //
  // Comparing the set of scoped rules against the set of scoped globs passes
  // whenever every rule appears somewhere and every glob appears somewhere — so
  // an override naming one rule for a second tree satisfies both unions while
  // the other 48 rules never run there at all. A review declared a second tree,
  // gave its override a single rule, and the harness stayed green.
  //
  // Built from the rules this config ENABLES, not from every rule that exists:
  // whether a rule is enabled at all is the separate registration-versus-
  // enablement question, and the config records one deliberate instance of a
  // rule held back (see the HELD BACK note on `arch/no-reflect-access`, tracked
  // by ea-48). This guard asks only that a rule enabled for one declared tree is
  // enabled for all of them.
  const enabledTreeRules = [...new Set(scopedArchKeys)].filter((key) => treeDependent.has(key));
  const expectedPairs = enabledTreeRules
    .flatMap((key) => DECLARED_TREES.map((tree) => `${key} @ ${tree.root}/**`))
    .sort();
  const actualPairs = scopedEntries
    .flatMap((entry) =>
      Object.keys(entry.rules ?? {})
        .filter((key) => key.startsWith("arch/"))
        .flatMap((key) => (entry.files ?? []).map((glob) => `${key} @ ${glob}`)),
    )
    .sort();

  const unscoped = expectedPairs.filter((pair) => !actualPairs.includes(pair));
  // A root missing EVERY pairing is a whole tree nothing runs over, which is the
  // common case and deserves its own sentence rather than 49 near-identical ones.
  const rootsWithNothing = DECLARED_TREES.map((tree) => `${tree.root}/**`).filter(
    (glob) => !actualPairs.some((pair) => pair.endsWith(` @ ${glob}`)),
  );
  for (const glob of rootsWithNothing) {
    failures.push(
      `policy/declared-trees.ts declares a tree setup/oxlintrc.json never scopes the rules to ` +
        `(no "${glob}" glob), so oxlint runs no architecture rule over it`,
    );
  }
  const partial = unscoped.filter((pair) => !rootsWithNothing.some((glob) => pair.endsWith(` @ ${glob}`)));
  if (partial.length > 0) {
    failures.push(
      `setup/oxlintrc.json never runs ${partial.length} rule/tree ${partial.length === 1 ? "pairing" : "pairings"} ` +
        `its declared trees imply — e.g. ${partial.slice(0, 3).join(", ")}. Every tree-dependent rule ` +
        `must be enabled for every declared root; a rule present for one tree and absent for another ` +
        `is a rule that tree adopted and never runs`,
    );
  }
  const unowned = actualPairs.filter((pair) => !expectedPairs.includes(pair));
  if (unowned.length > 0) {
    failures.push(
      `setup/oxlintrc.json scopes ${unowned.slice(0, 3).join(", ")} — a rule/tree pairing no ` +
        `declared tree and tree-dependent rule imply, so either the glob names a root nothing ` +
        `declares or the rule reads no tree`,
    );
  }

  return failures;
}

/**
 * The commit gate's lint glob names the same eight extensions the tier walks.
 *
 * The shipped `lefthook.yml` decides which STAGED files oxlint ever sees, and it
 * is the one place that decision is spelled outside `SOURCE_EXTENSIONS`. A review
 * measured the drift: the glob listed four of the eight, so a staged `.mts`,
 * `.cts`, `.mjs` or `.cjs` file produced `lint (skip) no files for inspection`
 * and reached no architecture rule at all — every rule silent on a whole class of
 * file, at the exact moment the rules are supposed to block.
 *
 * NEGATIVE SPACE: the `format` job's glob is deliberately NOT pinned. It is a
 * formatter's subject, not this tier's, and it carries `json` and `css` that no
 * source-extension list has an opinion about — pinning it would make this guard
 * the second owner of a question `SOURCE_EXTENSIONS` does not answer.
 */
async function checkCommitGateExtensions(): Promise<string[]> {
  const { SOURCE_EXTENSION_GLOB } = (await import(join(POLICY_ROOT, "layout.ts"))) as {
    SOURCE_EXTENSION_GLOB: string;
  };
  const lefthook = await readFile(LEFTHOOK_PATH, "utf8");

  // The `lint` job's own block, and EXACTLY one of them. `- name: lint` with a
  // word boundary also matched `- name: lint-compat`: a review added that job
  // carrying the correct glob, left the real `lint` job on four extensions, and
  // this guard stayed green while the thing it guards was broken. The scalar has
  // to end at the line.
  const lintJobs = [...lefthook.matchAll(/^\s*- name: lint$[\s\S]*?\n\s+run:/gm)];
  if (lintJobs.length !== 1) {
    return [
      `setup/lefthook.yml has ${lintJobs.length} jobs named exactly \`lint\`, and this guard ` +
        `reads the one. Zero means the job was renamed and the guard now pins nothing; more ` +
        `than one means it cannot tell which glob gates the commit`,
    ];
  }
  const glob = /glob:\s*"([^"]+)"/.exec(lintJobs[0]?.[0] ?? "")?.[1];

  if (glob === undefined) {
    return [
      `setup/lefthook.yml's \`lint\` job has no \`glob:\`, so the guard that pins it to ` +
        `SOURCE_EXTENSIONS has nothing to read — restore the glob or delete this check`,
    ];
  }
  if (glob !== SOURCE_EXTENSION_GLOB) {
    return [
      `setup/lefthook.yml lints staged ${glob} while policy/layout.ts walks ` +
        `${SOURCE_EXTENSION_GLOB}. Files matching the second and not the first are staged, ` +
        `committed, and seen by no oxlint architecture rule`,
    ];
  }
  return [];
}
