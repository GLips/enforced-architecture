// ─── api/feature-visibility ───────────────────────────────────────────
//
// Tag:       api
// Mechanism: structural check (consumes the resolved import graph)
// Blocking:  Mixed — ungranted edges block, stale grants warn
//
// Prevents:  Cross-feature imports the importee never granted. A qualified
//            export at the feature boundary, JPMS `exports … to` style: feature
//            B names each feature allowed to import it, with a written
//            justification per grant. Everything else denies.
//
// The mechanism is the point, and it is smaller than it looks: the friction sits
// on the IMPORTEE's side, in a file, in the diff. A central allowlist enforces
// the same edges and buys none of this, because an edit to a config the author
// already had open reads as part of the work. Making feature A's new dependency
// require an edit to feature B — a file the author had no reason to touch — is
// what turns silent accretion into a decision someone has to write a sentence
// about. The sentence is the deliverable; the JSON is bookkeeping.
//
// See api/feature-visibility.md for when to take it and why it is not cycle
// detection.
//
// ──────────────────────────────────────────────────────────────────────

import type { Finding, StructuralCheck } from "../check-substrate.ts";
import { readFile } from "../check-substrate.ts";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";

/** Importing feature name → why the importee accepts that consumer. */
type Grants = Map<string, string>;

type VisibilityFile =
  | { kind: "grants"; grants: Grants }
  | { kind: "absent" }
  | { kind: "malformed"; reason: string };

export const featureVisibilityCheck: StructuralCheck = {
  id: "api/feature-visibility",

  run({ config, importGraph, subdirs }) {
    const { visibilityFilename } = config.checks["api/feature-visibility"];
    const { featuresDirName } = config.source;
    const findings: Finding[] = [];

    const featuresDir = `${config.source.roots[0]}/${featuresDirName}`;
    const pathOf = (feature: string) => `${featuresDir}/${feature}/${visibilityFilename}`;
    const readGrantsFor = (feature: string) =>
      readVisibilityFile(join(config.projectRoot, pathOf(feature)));

    // `subdirs`, not `occupiedDirs`: a feature here is a DIRECTORY, occupied or
    // not. Both of the occupancy filter's exclusions are wrong for this rule.
    // `occupiedDirs` globs `**/*.{ts,tsx}` while the import graph collects
    // `**/*.{ts,tsx,mts,cts}`, and it drops whatever `source.exclude` matches, so
    // the graph routes edges into features that enumeration cannot see. And the
    // occupancy test itself argues the other way here: an empty directory
    // manufactures a feature for `graph/feature-deps`, which needs two to have a
    // subject, whereas a leftover directory holding nothing but a visibility.json
    // full of grants is precisely what this rule exists to audit.
    const visibility = new Map(
      subdirs(featuresDirName).map((feature) => [feature, readGrantsFor(feature)]),
    );

    for (const [feature, file] of visibility) {
      if (file.kind !== "malformed") continue;
      findings.push({
        severity: "error",
        file: pathOf(feature),
        message:
          `${visibilityFilename} is unreadable: ${file.reason}\n` +
          `Until it parses, every import of ${feature} is unaudited.`,
      });
    }

    // Feature ends come from the classification, never from the specifier text:
    // `../../beta/service` is the same edge as `@/features/beta` and must need
    // the same grant. A check that pattern-matches `@/features/<name>` passes
    // the relative spelling silently, which is the adversarial case that decides
    // this rule.
    //
    // Type-only imports count. A type crossing a feature boundary still couples
    // the two — the importee cannot reshape it without breaking the importer —
    // so erasure at runtime buys no exemption.
    const importersByEdge = new Map<string, Set<string>>();
    for (const edge of importGraph()) {
      const importer = edge.from.feature;
      const importee = edge.to.feature;
      if (importer === undefined || importee === undefined || importer === importee) continue;
      const key = `${importer}\0${importee}`;
      importersByEdge.set(key, (importersByEdge.get(key) ?? new Set()).add(edge.file));
    }

    for (const [key, files] of importersByEdge) {
      const [importer = "", importee = ""] = key.split("\0");
      // Missing from the map is not the same question as missing from the tree,
      // and conflating them is how this rule has been wrong twice. The map is
      // keyed by directory names as the filesystem SPELLS them; `classify`
      // derives the importee from the resolved path TEXT. Every name where those
      // disagree — a case-mismatched specifier that a case-insensitive
      // filesystem happily loads, a symlinked feature — is an importee the map
      // has no key for while the module resolver reaches real code. Skipping
      // those is deny-by-default with a hole in it, written as ordinary code.
      //
      // So ask the tree, and skip only for a name that is genuinely not a
      // directory. That is the loose-file case and nothing else: `classify`
      // reads `features/orphan-module.ts` as a feature named `orphan-module.ts`,
      // and denying it would file at `orphan-module.ts/visibility.json`, a path
      // nobody can create and a finding nobody can clear. `placement/topology`
      // already reports the loose file, which is the actionable half.
      const file =
        visibility.get(importee) ??
        (isFeatureDirectory(join(config.projectRoot, featuresDir), importee)
          ? readGrantsFor(importee)
          : undefined);
      if (file === undefined) continue;
      // A malformed file already reported itself. Deriving deny-all violations
      // from it would bury that one real error under every edge into the feature.
      if (file.kind === "malformed") continue;
      if (file.kind === "grants" && file.grants.has(importer)) continue;

      findings.push({
        severity: "error",
        // Filed against the visibility file, not the importing code: that is
        // where the fix lands, and pointing at it is half of what the rule teaches.
        file: pathOf(importee),
        message:
          `${importer} imports ${importee}, which has not granted it.\n` +
          [...files].sort().map((path) => `  ${path}`).join("\n") +
          `\nAdd "${importer}" with a justification for why ${importee} accepts this\n` +
          `consumer — the grant is the importee's to make. Or lift the shared code to\n` +
          `domains/ or shared/: neither carries a visibility edge, so both features\n` +
          `reach it without coupling to each other. Extraction is usually the right\n` +
          `answer; the grant is the expensive one.`,
      });
    }

    for (const [feature, file] of visibility) {
      if (file.kind !== "grants") continue;
      for (const importer of file.grants.keys()) {
        if (importersByEdge.has(`${importer}\0${feature}`)) continue;

        findings.push({
          severity: "warning",
          file: pathOf(feature),
          // The existence test picks between two messages that send the reader
          // to two different places, so it has to be the same answer the deny
          // arm uses. Keyed off a narrower walker it tells someone their valid
          // grant names nothing and sends them to fix a spelling that is already
          // right — a wording-only divergence, which is the class no count or
          // path assertion can see.
          message: visibility.has(importer)
            ? `Grants "${importer}", which imports nothing from ${feature}. Drop the entry —\n` +
              `a grant outliving its import lets the coupling return with no diff, which is\n` +
              `the one moment this rule exists to make visible.`
            : `Grants "${importer}", which is not a feature. A grant naming nothing denies\n` +
              `the import it was written to allow.`,
        });
      }
    }

    return findings;
  },
};

/**
 * Whether `name` is a directory under the features root, asked of the tree
 * rather than of a listing. A listing answers in the filesystem's spelling; this
 * answers in the importer's, which is what the module resolver used.
 */
function isFeatureDirectory(featuresRoot: string, name: string): boolean {
  return statSync(join(featuresRoot, name), { throwIfNoEntry: false })?.isDirectory() === true;
}

function readVisibilityFile(absolute: string): VisibilityFile {
  if (!existsSync(absolute)) return { kind: "absent" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFile(absolute));
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
    // An empty justification is a grant nobody had to think about — the exact
    // thing this rule exists to prevent. Reject the file rather than honour it.
    if (typeof justification !== "string" || justification.trim() === "") {
      return { kind: "malformed", reason: `entry "${importer}" needs a non-empty justification string` };
    }
    grants.set(importer, justification);
  }
  return { kind: "grants", grants };
}
