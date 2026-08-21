#!/usr/bin/env bun
// ─── The catalog's own doc-budget ratchet ─────────────────────────────
//
// Runs the SHIPPED `health/doc-budgets` check against this repository's docs,
// with `docs/doc-budgets.manifest.json` as the manifest. The catalog tells
// adopters that a doc agents read on every task needs a ceiling that only moves
// down; this is that claim applied to the catalog itself, which is the only
// version of it anyone can check.
//
// It imports the shipped check rather than reimplementing the count, so the
// ratchet the catalog ships and the ratchet the catalog lives under cannot
// drift. A change to `doc-budgets.ts` that breaks the check breaks this too.
//
// ── NEGATIVE SPACE ────────────────────────────────────────────────────
//
// The manifest budgets the standing prose only: `CLAUDE.md`, `README.md`,
// `harness/README.md`, `SKILL.md` and the eight files under `references/`.
//
// It deliberately does NOT budget:
//
//   - `references/lint/**/overview.md`. Those are rule indexes. Their length is
//     a function of how many rules the tag holds, so a ceiling on one is a
//     ceiling on the rule count, and the fix for an overrun would be deleting a
//     row rather than deleting words.
//   - Rule file header comments. They are code, and `health/file-size` is the
//     check with a claim on them.
//   - Anything under `docs/plans/`. Written once, appended to by design.
//
// ── Adapt ─────────────────────────────────────────────────────────────
//
// Nothing here. Ceilings live in the manifest. To see current usage against
// ceiling without a verdict:
//
//   bun skills/enforced-architecture/references/lint/structural/health/doc-budgets.ts \
//     --list docs/doc-budgets.manifest.json
//
// ──────────────────────────────────────────────────────────────────────

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ArchitectureConfig } from "../skills/enforced-architecture/references/lint/structural/config.ts";
import { defaultCheckConfigs } from "../skills/enforced-architecture/references/lint/structural/config.ts";
import { docBudgetsCheck } from "../skills/enforced-architecture/references/lint/structural/health/doc-budgets.ts";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const config: ArchitectureConfig = {
  projectRoot: repoRoot,
  checks: {
    ...defaultCheckConfigs,
    "health/doc-budgets": { manifestPath: "docs/doc-budgets.manifest.json" },
  },
};

const findings = docBudgetsCheck.scope === "project" ? await docBudgetsCheck.run({ config }) : [];

for (const finding of findings) {
  console.error(`  ${finding.severity.toUpperCase()}  ${finding.file}\n${finding.message}\n`);
}

if (findings.length > 0) {
  console.error(`${findings.length} doc-budget finding(s). See docs/doc-budgets.manifest.json.`);
  process.exitCode = 1;
} else {
  console.log("Doc budgets: every budgeted doc is at or below its ceiling, with no unclaimed slack.");
}
