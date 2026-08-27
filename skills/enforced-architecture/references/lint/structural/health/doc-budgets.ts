// ─── health/doc-budgets ───────────────────────────────────────────────
//
// Makes sure: Every doc in the manifest is at or below its word ceiling, and no
// ceiling sits further above the count than the deadband — 40 words, or 5% of
// the count for a doc long enough that 5% is the larger. When you add a
// paragraph to a budgeted doc, the same commit makes you cut one, move the
// text, or raise the number.
//
// A doc below its ceiling can still fail. A ceiling only moves down on its own.
// Do not delete the slack status to let a small doc pass. The words between a
// doc and an old ceiling are words the next agent adds with no manifest diff.
//
// `--ratchet` writes those reclaims instead of reporting them, and the commit
// hook is where it runs. Shrinking a doc is the behaviour this check exists to
// encourage, and failing the build for it taxes the wrong direction; the
// manifest diff the flag produces says everything the finding said. Growth is
// untouched — `--ratchet` never raises a ceiling, so adding words still costs a
// hand-edit somebody approves.
//
// The floor is what makes the deadband usable on a short doc. Under 5% alone a
// 360-word CLAUDE.md banks 18 words, so deleting one sentence fails the build.
// Do not replace it with a larger percentage: the drift a deadband absorbs is a
// reworded sentence, which costs the same words at any length, and 10% of a long
// doc is a section's worth of room the ratchet exists to deny.
//
// countWords counts tables, code fences and front matter. Do not make the count
// more exact with a Markdown parse that skips fenced blocks. A count that skips
// fences moves the text into fences.
//
// There is no pragma and no per-file override. A ceiling inside the doc lets one
// edit add both the words and the permission for them. Then no manifest diff
// exists for a person to approve.
//
// A manifest that is absent or does not parse is an error. Do not make it an
// empty run. One typo in manifestPath leaves every doc uncounted while the check
// reports clean. The fixture tree cannot test this branch: it holds one
// manifest, and every other case needs that manifest to parse. Zero entries is
// not an error: a project with no budgeted docs yet ships an empty manifest and
// stays registered, so the check starts governing the first doc the manifest
// names rather than waiting for someone to remember it exists.
//
// ──────────────────────────────────────────────────────────────────────

import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readFile, type Finding, type StructuralCheck } from "../check-context.ts";

/**
 * How far a ceiling may sit above the doc it governs, as a fraction of the count
 * and as a floor in words, whichever is larger. Deliberately not config knobs:
 * they are the ratchet's tightness, and a project that can tune that tunes it
 * upward on the first commit the ratchet inconveniences.
 *
 * The floor binds below 800 words, the fraction above it.
 */
const RATCHET_HEADROOM = 0.05;
const RATCHET_FLOOR = 40;

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
  return words + Math.max(RATCHET_FLOOR, Math.ceil(words * RATCHET_HEADROOM));
}

/**
 * The manifest `--ratchet` would write, or `undefined` when nothing moves.
 *
 * Only `slack` rows are touched, and only downward. An `over` row is a doc that
 * outgrew its budget and a decision somebody owes; `missing` and `invalid` are
 * typos. Writing any of the three would be this flag deciding the thing it was
 * added to stop deciding.
 */
export function ratchetCeilings(rows: DocBudgetRow[]): Record<string, unknown> | undefined {
  let moved = false;
  // Every row is copied, including the unusable ones. Dropping a row this flag
  // cannot fix would delete a budget silently, which is the one outcome worse
  // than the finding it was meant to replace.
  const next: Record<string, unknown> = {};
  for (const { path, ceiling, words, status } of rows) {
    if (status === "slack" && words !== undefined) {
      next[path] = maxCeiling(words);
      moved = true;
    } else {
      next[path] = ceiling;
    }
  }
  return moved ? next : undefined;
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
  // Project-scoped: a doc is not in a tree, and counting it once per declared
  // tree would report the same overrun twice in a monorepo.
  scope: "project",

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
            `${words} words against a ${ceiling}-word ceiling: ${ceiling - words} words of slack,\n` +
            `past the ${maxCeiling(words) - words} this doc is allowed. The doc shrank and its ceiling did not.\n` +
            `Run the ratchet to lower it to ${maxCeiling(words)}, or edit ${manifestPath} by hand —\n` +
            `unclaimed slack is room the next agent expands into with no diff anyone reads.`,
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
//     node lint/structural/health/doc-budgets.ts --list docs/doc-budgets.manifest.json
//
// Doc paths inside the manifest resolve against the working directory, so run it
// from the project root.
if (import.meta.main) {
  const [flag, manifestPath] = process.argv.slice(2);
  if ((flag !== "--list" && flag !== "--ratchet") || manifestPath === undefined) {
    console.error("usage: node doc-budgets.ts --list|--ratchet <manifest-path>");
    process.exit(1);
  }

  const manifest = readDocBudgets(process.cwd(), manifestPath);
  if (manifest.kind === "unreadable") {
    console.error(`${manifestPath}: ${manifest.reason}`);
    process.exit(1);
  }

  if (flag === "--list") {
    console.log(manifest.rows.map(listRow).join("\n"));
  } else {
    const next = ratchetCeilings(manifest.rows);
    if (next !== undefined) {
      writeFileSync(join(process.cwd(), manifestPath), `${JSON.stringify(next, null, 2)}\n`);
      for (const { path, ceiling, words, status } of manifest.rows) {
        if (status === "slack" && words !== undefined) {
          console.log(`${path}: ${ceiling} -> ${maxCeiling(words)} (${words} words)`);
        }
      }
    }
  }
}
