#!/usr/bin/env bun
/**
 * api/feature-visibility — a cross-feature import requires the importee's consent.
 *
 * Each feature declares who may import it in a `visibility.json` at its root: a flat
 * map of importing feature name -> justification. An edge A -> B is legal only if B's
 * file lists A. No file means no grants, so the default is deny.
 *
 * Adaptation seams: the two constants below, and the `./lib` import — point it at the
 * project's shared library. Everything else is portable.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { CheckResult, Finding, ImportEdge } from "./lib";

const CHECK_NAME = "feature-visibility";
const FEATURES_DIR = "src/features";
const VISIBILITY_FILENAME = "visibility.json";

/** Importing feature name -> why the importee accepts that consumer. */
type Grants = Map<string, string>;

type VisibilityFile =
  | { kind: "grants"; grants: Grants }
  | { kind: "absent" }
  | { kind: "malformed"; reason: string };

function visibilityPath(feature: string): string {
  return `${FEATURES_DIR}/${feature}/${VISIBILITY_FILENAME}`;
}

function readVisibilityFile(feature: string, projectRoot: string): VisibilityFile {
  const absolute = join(projectRoot, visibilityPath(feature));
  if (!existsSync(absolute)) return { kind: "absent" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(absolute, "utf-8"));
  } catch (error) {
    return { kind: "malformed", reason: (error as Error).message };
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {
      kind: "malformed",
      reason: "must be a JSON object mapping importer feature names to justification strings",
    };
  }

  const grants: Grants = new Map();
  for (const [importer, justification] of Object.entries(parsed)) {
    // An empty justification is a grant nobody had to think about — the exact thing
    // this rule exists to prevent. Reject the file rather than honour the entry.
    if (typeof justification !== "string" || justification.trim() === "") {
      return { kind: "malformed", reason: `entry "${importer}" needs a non-empty justification string` };
    }
    grants.set(importer, justification);
  }
  return { kind: "grants", grants };
}

/**
 * @param edges  The resolved import graph. Feature ends are read from the
 *               classification, never from the specifier text: `../../beta/service`
 *               is the same edge as `@/features/beta` and must need the same grant.
 * @param features  Feature directories holding at least one source file. Passed in
 *               rather than read here so a feature with no edges still gets its
 *               grants audited.
 */
export function checkFeatureVisibility(
  edges: ImportEdge[],
  features: string[],
  projectRoot: string,
): CheckResult {
  const errors: Finding[] = [];
  const warnings: Finding[] = [];

  const visibility = new Map(features.map((feature) => [feature, readVisibilityFile(feature, projectRoot)]));

  for (const [feature, file] of visibility) {
    if (file.kind === "malformed") {
      errors.push({
        file: visibilityPath(feature),
        message: `${VISIBILITY_FILENAME} is unreadable: ${file.reason}`,
      });
    }
  }

  // Type-only imports count. A type crossing a feature boundary still couples the two
  // — the importee cannot reshape it without breaking the importer — so erasure at
  // runtime buys no exemption here.
  const edgeFiles = new Map<string, Set<string>>();
  for (const edge of edges) {
    const importer = edge.from.feature;
    const importee = edge.to.feature;
    if (!importer || !importee || importer === importee) continue;
    const key = `${importer}\0${importee}`;
    const files = edgeFiles.get(key) ?? new Set<string>();
    files.add(edge.file);
    edgeFiles.set(key, files);
  }

  for (const [key, files] of edgeFiles) {
    const [importer, importee] = key.split("\0");
    const file = visibility.get(importee);
    // A malformed file already reported itself. Deriving deny-all violations from it
    // would bury that one real error under every edge into the feature.
    if (!file || file.kind === "malformed") continue;
    if (file.kind === "grants" && file.grants.has(importer)) continue;

    // The finding is filed against the visibility file, not the importing code: that
    // is where the fix lands, and pointing at it is half of what the rule teaches.
    errors.push({
      file: visibilityPath(importee),
      message:
        `${importer} imports ${importee}, which has not granted it.\n` +
        [...files].sort().map((f) => `    ${f}`).join("\n") +
        `\n  Add "${importer}" to ${visibilityPath(importee)} with a justification for why ` +
        `${importee} accepts this consumer — the grant is the importee's to make.\n` +
        `  Or lift the shared code to domains/* or shared/*: neither carries a visibility ` +
        `edge, so both features reach it without coupling to each other.`,
    });
  }

  for (const [feature, file] of visibility) {
    if (file.kind !== "grants") continue;
    for (const importer of file.grants.keys()) {
      if (edgeFiles.has(`${importer}\0${feature}`)) continue;

      warnings.push({
        file: visibilityPath(feature),
        message: visibility.has(importer)
          ? `Grants "${importer}", which imports nothing from ${feature}. Drop the entry — ` +
            `a grant outliving its import lets the coupling return with no diff, which is ` +
            `the one moment this rule exists to make visible.`
          : `Grants "${importer}", which is not a feature. A grant naming nothing denies the ` +
            `import it was written to allow.`,
      });
    }
  }

  return { name: CHECK_NAME, errors, warnings };
}
