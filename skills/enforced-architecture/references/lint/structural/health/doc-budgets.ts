// ─── health/doc-budgets ───────────────────────────────────────────────
//
// Tag:       health
// Mechanism: structural check (word counts against a manifest)
// Blocking:  Yes
//
// Prevents:  Standing documentation growing without bound. Every doc a project
//            asks agents to read is a doc agents keep appending to, one
//            reasonable paragraph at a time, until the file nobody budgeted is
//            the file nobody reads.
//
// The contract, in three parts:
//
//   1. Every budgeted doc has a word ceiling in the manifest, and exceeding it
//      fails. `wc -w` equivalent: whitespace-delimited tokens, tables and code
//      fences included, because they take a reader's attention like any other
//      words do.
//   2. A ceiling more than 5% above the doc's actual size fails too. That is the
//      ratchet, and it is the half that does the work: a ceiling only ever
//      moves down on its own. Slack left behind by a doc that shrank is room the
//      next agent expands into without anyone seeing a diff.
//   3. Raising a ceiling is therefore an explicit edit to the manifest, in the
//      same commit as the prose it makes room for, where a human declines it or
//      approves it on the record. The number is bookkeeping; the sentence in the
//      commit message is the deliverable.
//
// The check RETURNS findings and never exits — the orchestrator owns the exit
// code, so a failing budget blocks the commit the same way every other check
// does. `--list` is the one mode here, and it enforces nothing: see the note
// above the CLI at the bottom of this file.
//
// See health/doc-budgets.md for what belongs in the manifest and what does not.
//
// ──────────────────────────────────────────────────────────────────────

import { existsSync } from "node:fs";
import { join } from "node:path";
import { readFile, type Finding, type StructuralCheck } from "../check-substrate.ts";

/**
 * How far a ceiling may sit above the doc it governs. Deliberately not a config
 * knob: it is the ratchet's tightness, and a project that can tune it tunes it
 * upward on the first commit the ratchet inconveniences.
 */
const RATCHET_HEADROOM = 0.05;

export type DocBudgetStatus = "ok" | "over" | "slack" | "missing" | "invalid";

export type DocBudgetRow = {
  /** Project-relative doc path, exactly as the manifest spells it. */
  path: string;
  /** The manifest's raw value. `status: "invalid"` is what says it is not a ceiling. */
  ceiling: unknown;
  /** `undefined` only when the file is not there to count. */
  words: number | undefined;
  status: DocBudgetStatus;
};

export type DocBudgetManifest =
  | { kind: "rows"; rows: DocBudgetRow[] }
  | { kind: "unreadable"; reason: string };

/** `wc -w` equivalent: whitespace-delimited tokens. */
export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/** The highest ceiling a doc of this size may carry before the ratchet fires. */
export function maxCeiling(words: number): number {
  return Math.ceil(words * (1 + RATCHET_HEADROOM));
}

/**
 * Reads the manifest and counts every doc it names.
 *
 * A bad entry is scoped to its own row rather than rejecting the file, which is
 * the opposite of how `api/feature-visibility` treats a malformed grant and for
 * the opposite reason: one unusable ceiling leaves one doc unbudgeted, and
 * dropping the other twenty rows to say so hides twenty real counts behind a
 * typo.
 */
export function readDocBudgets(projectRoot: string, manifestPath: string): DocBudgetManifest {
  const absolute = join(projectRoot, manifestPath);
  if (!existsSync(absolute)) {
    return { kind: "unreadable", reason: "no manifest at this path" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFile(absolute));
  } catch (error) {
    return { kind: "unreadable", reason: (error as Error).message };
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {
      kind: "unreadable",
      reason: "must be a JSON object mapping doc paths to integer word ceilings",
    };
  }

  const rows = Object.entries(parsed).map(([path, ceiling]): DocBudgetRow => {
    const doc = join(projectRoot, path);
    const words = existsSync(doc) ? countWords(readFile(doc)) : undefined;
    return { path, ceiling, words, status: statusOf(ceiling, words) };
  });
  return { kind: "rows", rows };
}

function statusOf(ceiling: unknown, words: number | undefined): DocBudgetStatus {
  if (typeof ceiling !== "number" || !Number.isInteger(ceiling) || ceiling <= 0) return "invalid";
  if (words === undefined) return "missing";
  if (words > ceiling) return "over";
  if (ceiling > maxCeiling(words)) return "slack";
  return "ok";
}

export const docBudgetsCheck: StructuralCheck = {
  id: "health/doc-budgets",

  run({ config }) {
    const { manifestPath } = config.checks["health/doc-budgets"];
    const manifest = readDocBudgets(config.projectRoot, manifestPath);

    if (manifest.kind === "unreadable") {
      return [
        {
          severity: "error",
          file: manifestPath,
          message:
            `Unreadable: ${manifest.reason}\n` +
            `Until it parses, every doc it budgets is uncounted and this check reports\n` +
            `clean on zero entries — which is indistinguishable from a working one.`,
        },
      ];
    }

    const findings: Finding[] = [];
    for (const { path, ceiling, words, status } of manifest.rows) {
      if (status === "invalid") {
        findings.push({
          severity: "error",
          // Filed against the manifest: the value is there, and the doc itself may
          // be perfectly fine.
          file: manifestPath,
          message:
            `"${path}": ceiling must be a positive integer, got ${JSON.stringify(ceiling)}.\n` +
            `An entry that is not a number budgets nothing while reading as coverage.`,
        });
        continue;
      }
      if (status === "missing") {
        findings.push({
          severity: "error",
          file: path,
          message:
            `Budgeted, but there is no file here.\n` +
            `Renamed or deleted? Update ${manifestPath} in the same change — a ceiling\n` +
            `over an absent doc is a budget nobody is spending.`,
        });
        continue;
      }
      if (words === undefined || typeof ceiling !== "number") continue;

      if (status === "over") {
        findings.push({
          severity: "error",
          file: path,
          message:
            `${words} words against a ${ceiling}-word ceiling.\n` +
            `Condense, or move the material to the doc that owns it. Raising the ceiling\n` +
            `in ${manifestPath} is the other option, and it is a diff someone has to\n` +
            `approve with a reason.`,
        });
      } else if (status === "slack") {
        findings.push({
          severity: "error",
          file: path,
          message:
            `${words} words against a ${ceiling}-word ceiling: more than ${RATCHET_HEADROOM * 100}% slack.\n` +
            `The doc shrank and its ceiling did not. Lower it to ${maxCeiling(words)} or below in\n` +
            `this same change — unclaimed slack is room the next agent expands into with\n` +
            `no diff anyone reads.`,
        });
      }
    }
    return findings;
  },
};

const LIST_LABELS: Record<DocBudgetStatus, string> = {
  ok: "ok",
  over: "OVER",
  slack: "SLACK",
  missing: "MISS",
  invalid: "BAD",
};

function listRow({ path, ceiling, words, status }: DocBudgetRow): string {
  const used = words === undefined ? "—" : String(words);
  const budget = typeof ceiling === "number" ? String(ceiling) : JSON.stringify(ceiling);
  return `${LIST_LABELS[status].padEnd(5)} ${used.padStart(6)} / ${budget.padEnd(6)} ${path}`;
}

// `--list` prints usage against ceiling and decides nothing: no findings, no
// verdict, exit 0 whatever it shows. That is why it exists here rather than in
// the orchestrator, which owns every mode that can pass or fail a run — the same
// line `graph/feature-deps` draws when it refuses a `--baseline` flag. What this
// serves is the moment BEFORE the manifest exists, when there are no ceilings to
// enforce and someone has to pick the first numbers from what the docs already
// weigh.
//
//     bun lint/structural/health/doc-budgets.ts --list docs/doc-budgets.manifest.json
//
// Doc paths inside the manifest resolve against the working directory, so run it
// from the project root.
if (import.meta.main) {
  const [flag, manifestPath] = process.argv.slice(2);
  if (flag !== "--list" || manifestPath === undefined) {
    console.error("usage: bun doc-budgets.ts --list <manifest-path>");
    process.exit(1);
  }

  const manifest = readDocBudgets(process.cwd(), manifestPath);
  if (manifest.kind === "unreadable") {
    console.error(`${manifestPath}: ${manifest.reason}`);
    process.exit(1);
  }
  console.log(manifest.rows.map(listRow).join("\n"));
}
