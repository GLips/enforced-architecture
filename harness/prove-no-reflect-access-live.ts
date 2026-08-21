#!/usr/bin/env bun
/**
 * Proves `types/no-reflect-access` reports under the REAL oxlint CLI.
 *
 * One rule, deliberately. This is not a second rule harness — it exists because
 * `run-rule-fixtures.ts` cannot see the defect this rule shipped with, and no
 * amount of extra spec cases would have.
 *
 * The defect: the rule asked "does any enclosing scope bind `Reflect`?" and
 * treated a hit as a local shadow. Under the CLI the global scope declares
 * `Reflect`, so every use answered yes and the rule returned early on all of
 * them — inert, exit 0, nothing printed. Its whole spec stayed green, because
 * `RuleTester` populates no global scope and the walk is right in that host. A
 * rule is only as proved as its host is real, and RuleTester's host is not the
 * one an adopting project runs.
 *
 *     bun run check:no-reflect-access-live
 *
 * So this materializes real files, runs the shipped `plugin.ts` over them through
 * the `oxlint` binary, and reads the diagnostics back. Two cases, and both are
 * load-bearing in opposite directions: without the reporting one, the inert rule
 * passes; without the silent one, a rule that dropped its shadow check passes.
 *
 * REVERT-PROBE after any change here, all three. Put back the old scope walk (`if
 * (scope.set.has(name)) return true`) and the reporting case must fail; delete
 * the `resolvesToLocalBinding` call from the rule and the silent case must fail;
 * set the shipped config's key to `"off"` and the enablement check must fail. A
 * run that stays green through any of them is testing nothing.
 *
 * NEGATIVE SPACE, and it is why this file is named after one rule rather than
 * after the technique:
 *
 *   - It is not the shipped `setup/oxlintrc.json`. That config names
 *     `eslint-plugin-sonarjs` and turns `typeAware` on, and this repo depends on
 *     neither — the CLI refuses to parse it here. The config below is a minimum
 *     that loads the same `plugin.ts` and scopes the same rule to the same
 *     declared tree, so what it proves is the rule, not the manifest. The one
 *     tie to the shipped file is the enablement check below.
 *   - It says nothing about the other 49 rules. Every one of them is proved
 *     through RuleTester alone and carries the same blind spot. Generalizing
 *     this into the rule harness is ea-49; until it lands, a green
 *     `check:rules` still does not mean a rule fires in the linter.
 *   - It reads only diagnostics carrying this rule's code. Another rule firing
 *     on these files, or staying silent on them, is not this file's question.
 */

import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DECLARED_TREES } from "../skills/enforced-architecture/references/lint/policy/declared-trees.ts";

const HARNESS_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HARNESS_DIR, "..");
const PLUGIN_PATH = join(REPO_ROOT, "skills/enforced-architecture/references/lint/oxlint/plugin.ts");
const OXLINTRC_PATH = join(REPO_ROOT, "skills/enforced-architecture/references/setup/oxlintrc.json");
const OXLINT_BIN = join(REPO_ROOT, "node_modules/.bin/oxlint");

/** The config key, and the `code` field the CLI stamps on every diagnostic it raises. */
const RULE_KEY = "arch/no-reflect-access";
const RULE_CODE = "arch(no-reflect-access)";

/**
 * A governed position in the first declared tree, spelled in that tree's own
 * vocabulary rather than hardcoded. The rule is gated on
 * `classifyFileRole(filename, cwd)`, so a file outside a declared tree reports
 * nothing for a reason that has nothing to do with the bug under test — and a
 * hardcoded `src/features/…` would deliver exactly that silence, as a pass, to
 * any project that renamed a directory.
 */
const TREE = DECLARED_TREES[0];
if (TREE === undefined) throw new Error("policy/declared-trees.ts declares no tree to lint inside");
const SERVICE_DIR = join(
  TREE.root,
  TREE.vocabulary.featuresDir,
  "billing",
  TREE.vocabulary.featureLayerDirs.service,
);

type LiveCase = {
  /** What the case pins, in the terms of the defect rather than of the syntax. */
  name: string;
  file: string;
  code: string;
  /** The message the rule must deliver, or `null` for a case it must stay silent on. */
  reports: string | null;
};

const CASES: LiveCase[] = [
  {
    // The case the whole ticket is about: nothing in the file declares `Reflect`,
    // so under the CLI it resolves to the global scope's builtin — which is what
    // the old walk read as a shadow.
    name: "an unshadowed Reflect.get reports",
    file: "invoices.ts",
    code: `export const value = Reflect.get(invoice, key);\n`,
    reports: "`Reflect.get` returns `any` whatever the receiver was",
  },
  {
    // The property the rule pins, and the reason it resolves the name at all
    // instead of matching it. Under the CLI this file and the one above have the
    // SAME global binding in their chain, so only the definition site tells them
    // apart — a fix that reported on everything would pass the case above alone.
    name: "a locally bound Reflect stays silent",
    file: "local-reflect.ts",
    code: `const Reflect = { get: (o: Record<string, unknown>, k: string) => o[k] };\nexport const value = Reflect.get(invoice, key);\n`,
    reports: null,
  },
];

type OxlintDiagnostic = { code: string; message: string; filename: string };

const workspace = mkdtempSync(join(tmpdir(), "ea-no-reflect-access-"));
try {
  await assertShippedConfigEnablesTheRule();
  const diagnostics = lintMaterializedCases(workspace);
  let failed = 0;
  for (const testCase of CASES) {
    const failures = verdictFor(testCase, diagnostics);
    if (failures.length === 0) {
      console.log(`  PASS  ${testCase.name}`);
      continue;
    }
    failed += 1;
    console.log(`  FAIL  ${testCase.name}`);
    for (const detail of failures) console.log(`        ${detail}`);
  }
  if (failed > 0) process.exit(1);
  console.log(
    `\n${CASES.length}/${CASES.length} live cases: ${RULE_KEY} reports through the real oxlint CLI.`,
  );
} finally {
  rmSync(workspace, { recursive: true, force: true });
}

/**
 * The one tie between this file and the shipped manifest.
 *
 * Everything below runs a config of this file's own making, so on its own it
 * would prove a rule that works and say nothing about whether an adopting
 * project ever runs it. `run-rule-fixtures.ts` does not close that: its
 * tree-scoping guard asks which BLOCK an enabled rule sits in and deliberately
 * declines to ask whether a rule is enabled at all. So the key going missing
 * again — the exact state ea-48 fixed — would leave both files green.
 */
async function assertShippedConfigEnablesTheRule(): Promise<void> {
  const shipped = await readFile(OXLINTRC_PATH, "utf8");
  // The SEVERITY, not just the key. `"off"` is the shape the held-back state
  // would come back as if anyone reached for a softer version of it, and a key set
  // to `"off"` is the worse half of what the hold was: it reads as coverage from
  // every angle except a run.
  //
  // A substring rather than a parse: the shipped file is JSONC and the only
  // stripper for it lives in the other runner, where it is one guard's private
  // helper. A commented-out key does not survive this either — `// "arch/…"` has
  // no `":"` after the closing quote.
  if (!new RegExp(String.raw`^\s*"${RULE_KEY}"\s*:\s*"(error|warn)"`, "m").test(shipped)) {
    console.log(
      `  FAIL  setup/oxlintrc.json does not enable ${RULE_KEY} at error or warn, so this file ` +
        `proves a rule no adopting project runs`,
    );
    process.exit(1);
  }
}

/** Materialize the cases as real files and hand the directory to the CLI. */
function lintMaterializedCases(root: string): OxlintDiagnostic[] {
  mkdirSync(join(root, SERVICE_DIR), { recursive: true });
  for (const testCase of CASES) writeFileSync(join(root, SERVICE_DIR, testCase.file), testCase.code);
  writeFileSync(
    join(root, ".oxlintrc.json"),
    JSON.stringify(
      {
        // Absolute, because the workspace is a temp directory and the plugin's
        // own imports have to resolve against the repo it lives in.
        jsPlugins: [PLUGIN_PATH],
        rules: {},
        overrides: [{ files: [`${TREE.root}/**`], rules: { [RULE_KEY]: "error" } }],
      },
      null,
      2,
    ),
  );

  // `cwd` is the workspace, not this repo: `defineTreeRule` resolves a declared
  // root against `context.cwd`, so running from anywhere else puts every fixture
  // outside every tree and the rule returns early on all of them — a silence that
  // would read as the bug still being present.
  const run = spawnSync(OXLINT_BIN, ["--config", ".oxlintrc.json", "--format", "json", TREE.root], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  // A config the CLI refuses, or a missing binary, exits with EMPTY stdout and the
  // reason on stderr — so the parse has to be guarded rather than trusted. Reading
  // an empty report as zero diagnostics would turn every one of those into "the
  // rule stayed silent", which is the verdict this file exists to distinguish from
  // a real one.
  const stdout = run.stdout ?? "";
  const diagnostics = stdout.trim() === "" ? undefined : (JSON.parse(stdout) as { diagnostics?: OxlintDiagnostic[] }).diagnostics;
  if (diagnostics === undefined) {
    // `run.error` and not just the streams: a missing binary never starts, so it
    // leaves both of them empty and the reason only there.
    const reason = `${stdout}${run.stderr ?? ""}${run.error?.message ?? ""}`.trim();
    console.log(
      `  FAIL  the oxlint CLI produced no diagnostics report, so nothing here ran:\n` +
        `        ${reason.replace(/\n/g, "\n        ")}`,
    );
    process.exit(1);
  }
  return diagnostics;
}

function verdictFor(testCase: LiveCase, diagnostics: OxlintDiagnostic[]): string[] {
  const path = join(SERVICE_DIR, testCase.file);
  const raised = diagnostics.filter((d) => d.code === RULE_CODE && d.filename === path);

  if (testCase.reports === null) {
    return raised.length === 0
      ? []
      : [`${RULE_CODE} reported on ${path}, whose \`Reflect\` is a binding the file declares`];
  }
  if (raised.length === 0) {
    return [
      `${RULE_CODE} reported nothing on ${path} under the real CLI — the rule is inert there, ` +
        `whatever its spec says`,
    ];
  }
  // The message, not just the count. Which of the two messages a diagnostic
  // carries is the only thing separating the `get` verdict from the `apply` one,
  // and a rule reporting the wrong one is still a rule that reports.
  const expected = testCase.reports;
  return raised.some((d) => d.message.includes(expected))
    ? []
    : [`${path} reported ${RULE_CODE}, but no diagnostic said "${expected}"`];
}
