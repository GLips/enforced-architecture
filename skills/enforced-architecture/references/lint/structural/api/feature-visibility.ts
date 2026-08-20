// ─── api/feature-visibility ───────────────────────────────────────────
//
// Makes sure: Every import from one feature into another has an entry in the
// importee's visibility.json, with a written reason. To find every feature that
// depends on feature B, you read one file in B, not the whole repository. To add
// a dependency on B, you must edit B, so the diff shows the decision.
//
// Do not move the grants into one central file, and do not derive them from
// tags. Both find the same edges. An edit to a config file the author already
// has open looks like part of the task. An edit inside another feature does
// not. The rule depends on that difference.
//
// A grant names a feature, not a barrel and not a path. One entry covers the
// client barrel and index.server. Grants are not transitive: "A grants B" plus
// "B grants C" permits no edge between A and C.
//
// Stale grants are warnings, and the orchestrator hides warnings for files a
// commit did not stage. The case this arm exists for — an importer that drops
// its last import — stages nothing in the importee. Run this check in CI as
// well as in the pre-commit hook, or you do not see that case.
//
// A cycle of granted edges is graph/feature-deps's finding, not this one's. No
// grant makes a cycle legal.
//
// The enumeration is every DIRECTORY under features/, and a symlink is not one.
// A feature that exists only as a link out of the tree — vendored code, a
// hoisted package — is therefore audited by the deny arm alone, under the LINK
// name. Three consequences, and only the first is covered:
//
//   - Its grant file is read, so the edge is denied, cleared by a grant written
//     at the link, and reported when that file does not parse.
//   - A grant there that has outlived its import is never reported stale. That
//     arm walks the enumeration.
//   - Nothing walks the target, so the feature's OWN imports are not in the
//     graph. It is a feature as an importee and not as an importer, and an
//     ungranted edge leading out of it is invisible to this rule.
//
// Two links to one target are two features here, and on a case-insensitive
// filesystem so are two casings of one link: `realpathSync` collapses spellings
// onto an enumerated directory, and there is none to collapse onto. Both
// addresses reach the same physical file, so one grant clears both.
//
// Two importees this rule stays silent about, both because the finding would be
// unclearable. A loose FILE at the features root classifies as a feature named
// `orphan-module.ts`, and no `orphan-module.ts/visibility.json` can exist —
// `placement/topology` reports the file itself, which is the half that can be
// acted on. A link to a file outside the root is the same unaddressable name
// with nobody holding the other half: `Bun.Glob.scanSync` does not list a
// symlinked file, so the walkers never see it and topology does not report it
// either. That one is silence, not coverage.
//
// A grant naming a link is a grant naming nothing, in both directions and for a
// different reason than any of the above: an importER name comes from walking
// the tree, and the walk yields the directory. No edge can ever carry the link
// spelling, so the stale-grant arm is right to say the name is not a feature
// even where the deny arm now treats it as one.
// ──────────────────────────────────────────────────────────────────────

import type { Finding, StructuralCheck } from "../check-substrate.ts";
import { readFile } from "../check-substrate.ts";
import { existsSync, realpathSync, statSync } from "node:fs";
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

    // One owner for this sentence: it is raised from two places — the walk over
    // the enumeration below, and the deny arm, for the one feature the walk
    // cannot see. Two copies would let the escaped case drift into wording that
    // does not say what the enumerated case says.
    const unreadable = (feature: string, reason: string): Finding => ({
      severity: "error",
      file: pathOf(feature),
      message:
        `${visibilityFilename} is unreadable: ${reason}\n` +
        `Until it parses, every import of ${feature} is unaudited.`,
    });

    for (const [feature, file] of visibility) {
      if (file.kind === "malformed") findings.push(unreadable(feature, file.reason));
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
    // treats them as. A name that resolves to a DIRECTORY is a feature whether
    // or not the enumeration listed it; only a name resolving to a file, or to
    // nothing, is skipped. See `canonicalFeature`.
    const canonicalFeature = featureCanonicaliser(join(config.projectRoot, featuresDir), [
      ...visibility.keys(),
    ]);

    const importersByEdge = new Map<string, Set<string>>();
    for (const edge of importGraph()) {
      if (edge.from.kind !== "feature" || edge.to.kind !== "feature") continue;
      const importer = edge.from.feature;
      // Only the importee end. `edge.file` comes from walking the tree, never
      // from a specifier, so the importing end is already the name on disk.
      const importee = canonicalFeature(edge.to.feature);
      if (importee === undefined || importer === importee) continue;
      const key = `${importer}\0${importee}`;
      importersByEdge.set(key, (importersByEdge.get(key) ?? new Set()).add(edge.file));
    }

    // Reported after the loop, so a feature two importers reach is still one
    // finding. Keyed by feature rather than by edge for that reason.
    const unreadableEscapees = new Map<string, string>();

    for (const [key, files] of importersByEdge) {
      const [importer = "", importee = ""] = key.split("\0");
      // The map is keyed by the ENUMERATED directories, and one canonical
      // feature is not among them: a link whose target leaves the features root,
      // which `subdirs` does not list and `realpathSync` cannot fold onto
      // anything it does. Read its grant file at the path the message is about
      // to name — that read is what makes such a finding clearable.
      const escaped = !visibility.has(importee);
      const file = visibility.get(importee) ?? readGrantsFor(importee);
      // A malformed file already reported itself — unless the walk above could
      // not see it, and then nothing has. Skipping there too would leave an
      // unparseable grant file allowing every import of the feature in silence,
      // which is one typo's worth of off-switch on the hole `canonicalFeature`
      // exists to close.
      if (file.kind === "malformed") {
        if (escaped) unreadableEscapees.set(importee, file.reason);
        continue;
      }
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

    for (const [feature, reason] of unreadableEscapees) findings.push(unreadable(feature, reason));

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
          // assertion can see.
          //
          // It is the same answer even though the deny arm now canonicalises a
          // link out of the tree into a feature, because the subject here is the
          // IMPORTER end. That name comes from walking the tree, and the walk
          // yields directories, so no edge can ever carry a link spelling and a
          // grant naming one denies the import it was written to allow. `map` is
          // the right oracle for a name that has to match a walked one; the
          // canonicaliser is the right one for a name that has to match a
          // resolved one.
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
 * A name resolving to a DIRECTORY is a feature even when no enumerated one is
 * it. A link out of the features root — vendored code, a hoisted monorepo
 * package — is the resolver loading real code under a name the listing does not
 * contain, and answering "not a feature" there is deny-by-default with a hole in
 * it. It is its own feature, under the LINK name: that is the one spelling whose
 * `visibility.json` an author can create, and a finding nobody can clear is
 * worth no more than the silence it replaces. Where a project links features/
 * straight into `node_modules`, the grant the message asks for lands somewhere
 * an install overwrites — link a checked-in directory instead.
 *
 * Undefined is the two ways a name resolves to no feature, and both are about
 * that same clearability. A loose file at the features root classifies as a
 * feature (`features/orphan-module.ts` becomes a feature named
 * `orphan-module.ts`) and denying an import of it would file against
 * `orphan-module.ts/visibility.json`, a path nobody can create —
 * `placement/topology` reports the file itself, which is the half that can be
 * acted on. So the test is the directory, not "does it leave the root": a link
 * to a file outside it is still an unaddressable name. Nobody reports THAT one,
 * as the walkers do not list symlinked files either, and the header says so
 * rather than leaving it to read as covered. And a name resolving to nothing at
 * all is an import that does not load; whatever is wrong with it, it is not a
 * visibility question.
 */
function featureCanonicaliser(
  featuresRoot: string,
  features: string[],
): (name: string) => string | undefined {
  const byRealPath = new Map(
    features.map((feature) => [realpathSync(join(featuresRoot, feature)), feature]),
  );

  return (name) => {
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
    const enumerated = byRealPath.get(real);
    if (enumerated !== undefined) return enumerated;
    // Resolves outside the features root, so no enumerated directory can be it.
    // A directory there is loadable code and gets denied under the link name; a
    // file there is as unaddressable as the loose file at the root.
    return statSync(real).isDirectory() ? name : undefined;
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
