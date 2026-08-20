#!/usr/bin/env bun
// ─── The structural-check orchestrator ────────────────────────────────
//
// Runs every registered check against one config and owns everything the checks
// deliberately do not: reporting, warning suppression, and the exit code.
//
// A check that exits on its own hides every check after it, so checks RETURN
// findings and this decides what they mean. The same argument applies to a check
// that throws, which is why each one runs inside its own try: an unreadable file
// in `style/css-tokens` must not take `graph/domain-cycles` silent with it, and
// "this check crashed" has to arrive as a loud error rather than as an empty
// result indistinguishable from a clean one.
//
// ── Adapt ─────────────────────────────────────────────────────────────
//
// Point it at the project's config and wire it into the pre-commit hook and CI:
//
//   // package.json
//   { "scripts": { "check:arch": "oxlint && bun lint/structural/check-structure.ts" } }
//
//   // lint/structural/check-structure.ts
//   import { architectureConfig } from "./arch.config.ts";
//   import { reportStructuralChecks } from "./run-structural-checks.ts";
//   import { structuralChecks } from "./registry.ts";
//   process.exitCode = reportStructuralChecks(structuralChecks, architectureConfig);
//
// Drop the registrations for checks the project has not adopted — a check
// pointed at a root that does not exist returns cleanly, so an unadopted check
// left registered reads as coverage that is not there.
//
// ──────────────────────────────────────────────────────────────────────

import { DECLARED_TREES, type DeclaredTree } from "../policy/declared-trees.ts";
import type { ArchitectureConfig } from "./config.ts";
import {
  createTreeContexts,
  type Finding,
  type StructuralCheck,
} from "./check-substrate.ts";

export type CheckRun = {
  id: string;
  /**
   * Which declared tree this run covered, or undefined for a project-scoped
   * check. Part of the record rather than folded into the id because a
   * tree-scoped check produces one run PER TREE, and a tree whose run is missing
   * is the failure the whole declared-tree design exists to make visible.
   */
  tree: string | undefined;
  findings: Finding[];
  /** The error a check threw, if it did. Reported as a blocking finding. */
  crashed: Error | undefined;
};

/**
 * Runs every check and returns one record per run, in registration order: once
 * per declared tree for a tree-scoped check, once for a project-scoped one.
 *
 * One record per REGISTERED run, always — including for a run that returned
 * nothing. That is what makes "this check found nothing" distinguishable from
 * "this check never ran", which findings alone cannot say and which is how a
 * deleted or stubbed check leaves a suite reporting clean.
 *
 * `trees` defaults to the project's declared list and is a parameter for exactly
 * one caller: the fixture harness, which proves that a tree produces findings
 * when declared and none when not. An adopting project never passes it — the
 * config cannot name a tree, which is what stops the two tiers from disagreeing
 * about which trees exist.
 */
export function runStructuralChecks(
  checks: StructuralCheck[],
  config: ArchitectureConfig,
  trees: readonly DeclaredTree[] = DECLARED_TREES,
): CheckRun[] {
  const treeContexts = createTreeContexts(config, trees);
  const runs: CheckRun[] = [];

  for (const check of checks) {
    if (check.scope === "project") {
      runs.push(attempt(check.id, undefined, () => check.run({ config })));
      continue;
    }
    for (const context of treeContexts) {
      runs.push(attempt(check.id, context.tree.root, () => check.run(context)));
    }
  }

  return runs;
}

function attempt(id: string, tree: string | undefined, run: () => Finding[]): CheckRun {
  try {
    return { id, tree, findings: run(), crashed: undefined };
  } catch (error) {
    return { id, tree, findings: [], crashed: error as Error };
  }
}

/**
 * In the pre-commit context the hook passes the staged file set via
 * `STAGED_FILES` (project-relative, whitespace-separated). Warnings for files the
 * commit never opened are then suppressed — a commit should not be nagged about
 * pre-existing drift it did not touch. Errors are never filtered: a blocking
 * violation surfaces no matter where it lives. An unset variable (CI, a manual
 * run) means no filtering at all.
 */
function stagedWarningFilter(): (finding: Finding) => boolean {
  const raw = process.env.STAGED_FILES;
  if (raw === undefined) return () => true;
  const staged = new Set(raw.split(/\s+/).filter(Boolean));
  return (finding) => finding.severity === "error" || staged.has(finding.file);
}

function formatFinding(id: string, finding: Finding): string {
  const label = finding.severity === "error" ? "FAIL" : "WARN";
  const at = finding.line === undefined ? "" : `:${finding.line}`;
  const detail = finding.message
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");
  return `${label} [${id}] ${finding.file}${at}\n${detail}`;
}

/** Prints every finding and returns the process exit code: 1 if anything blocked. */
export function reportStructuralChecks(
  checks: StructuralCheck[],
  config: ArchitectureConfig,
): number {
  const keep = stagedWarningFilter();
  let errors = 0;
  let warnings = 0;

  for (const { id, tree, findings, crashed } of runStructuralChecks(checks, config)) {
    if (crashed !== undefined) {
      errors += 1;
      const where = tree === undefined ? "" : ` on ${tree}`;
      console.error(
        `FAIL [${id}] this check threw${where} and reported nothing, so its subject is unchecked:\n` +
          `  ${(crashed.stack ?? crashed.message).replace(/\n/g, "\n  ")}`,
      );
      continue;
    }

    for (const finding of findings) {
      if (!keep(finding)) continue;
      if (finding.severity === "error") errors += 1;
      else warnings += 1;
      console.error(formatFinding(id, finding));
    }
  }

  // The summary prints only once every check has RETURNED, and pairs with a
  // fixed status. Either signal alone was wrong in turn: exit status cannot say
  // "did this finish" (a blocking check firing exits 1, which is the tier
  // working), and output alone cannot either, because a throw in the last check
  // once reported a whole suite clean.
  if (errors > 0) {
    console.error(`\nStructural checks failed: ${errors} error(s), ${warnings} warning(s).`);
    return 1;
  }
  if (warnings > 0) console.error(`\nStructural checks passed with ${warnings} warning(s).`);
  else console.log("Structural checks passed.");
  return 0;
}
