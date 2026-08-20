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
import { existsSync, realpathSync } from "node:fs";
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
    // Two names for one directory are ONE feature, and the collapsing happens
    // HERE rather than at lookup, so the deny arm and the stale-grant arm key off
    // the same identity. Canonicalise on lookup instead and a grant written in
    // the real file clears the error while the grant itself reads as stale —
    // the author is told to delete what they just wrote.
    //
    // `realpathSync` is what makes a spelling into an identity: it resolves a
    // symlinked feature to its target, and on a case-insensitive filesystem it
    // returns the directory as stored, so `@/features/Closed` and
    // `@/features/closed` are the one feature the module resolver already
    // treats them as. A name that resolves to no feature directory — the loose
    // file at the features root, or a path that is simply not there — has no
    // canonical form and is skipped; see `canonicalFeature`.
    const canonicalFeature = featureCanonicaliser(join(config.projectRoot, featuresDir), [
      ...visibility.keys(),
    ]);

    const importersByEdge = new Map<string, Set<string>>();
    for (const edge of importGraph()) {
      const importer = edge.from.feature;
      // Only the importee end. `edge.file` comes from walking the tree, never
      // from a specifier, so the importing end is already the name on disk.
      const importee = canonicalFeature(edge.to.feature);
      if (importer === undefined || importee === undefined || importer === importee) continue;
      const key = `${importer}\0${importee}`;
      importersByEdge.set(key, (importersByEdge.get(key) ?? new Set()).add(edge.file));
    }

    for (const [key, files] of importersByEdge) {
      const [importer = "", importee = ""] = key.split("\0");
      // Every importee reaching this loop is a canonical feature name, so the
      // map has an entry — `canonicalFeature` dropped the edges whose importee
      // resolves to no feature directory.
      const file = visibility.get(importee);
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
          // arm uses — the map, which is every feature directory. Keyed off the
          // occupancy walker instead it tells someone their valid grant names
          // nothing and sends them to fix a spelling that is already right: a
          // wording-only divergence, which is the class no count or path
          // assertion can see. A grant is written by hand, so unlike an importee
          // it has no resolved spelling to canonicalise — an entry naming a
          // symlink rather than the directory reads as naming nothing, which is
          // the safe direction and the one the message already describes.
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
 * Maps a classified feature name onto the feature it actually IS, or undefined
 * when it is not a feature at all.
 *
 * The classification names features by path text, and the same directory has
 * more than one spelling: a symlink beside it, or any casing of it on a
 * case-insensitive filesystem. Resolving each name and matching on the real path
 * is what makes those one identity — the identity the module resolver already
 * uses, which is the only one that governs the same tree the imports do.
 *
 * Undefined covers the two ways a name resolves to no feature. A loose file at
 * the features root classifies as a feature (`features/orphan-module.ts` becomes
 * a feature named `orphan-module.ts`) and denying an import of it would file
 * against `orphan-module.ts/visibility.json`, a path nobody can create and a
 * finding nobody can clear — `placement/topology` reports the file itself, which
 * is the half that can be acted on. And a name resolving to nothing at all is an
 * import that does not load; whatever is wrong with it, it is not a visibility
 * question.
 */
function featureCanonicaliser(
  featuresRoot: string,
  features: string[],
): (name: string | undefined) => string | undefined {
  const byRealPath = new Map(
    features.map((feature) => [realpathSync(join(featuresRoot, feature)), feature]),
  );

  return (name) => {
    if (name === undefined) return undefined;
    // Already the name on disk in every ordinary case, which is worth short-
    // circuiting: this runs once per edge and the resolve is a syscall.
    if (byRealPath.has(join(featuresRoot, name))) return name;
    let real: string;
    try {
      real = realpathSync(join(featuresRoot, name));
    } catch {
      // The path is not there. Reading a specifier is reading arbitrary text, so
      // this is a boundary rather than an impossible case.
      return undefined;
    }
    return byRealPath.get(real);
  };
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
