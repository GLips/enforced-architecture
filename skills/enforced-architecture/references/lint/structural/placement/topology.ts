// ─── placement/topology ───────────────────────────────────────────────
//
// Makes sure: Each source file under a declared tree's root is at a path that a
// rule in this catalog matches. You can add a file and know that the layer
// rules read it. You do not have to look for the files that no pattern reaches
// before you trust a clean report.
//
// The check walks the whole source tree. Its subject is the absence of a match.
// A smaller scope leaves the paths outside it with no check at all, which is
// the exact condition this rule removes.
//
// The permitted names are a closed set, not a list of bad names. A list of bad
// names holds only the paths that a person thought of, and the next bad path is
// not on it.
//
// Do not test the first path segment alone. src/features/scanner/helpers.ts has
// the first segment `features` and passes that test. It is inside a feature but
// outside every layer, and it is the file this rule exists to find.
//
// Each message names a destination, not a refusal. This rule fires when a person
// has no obvious place for a file, and a refusal leaves that person at the same
// point. That person then turns the check off.
//
// A path this rule permits says nothing about the imports in the file or the
// kind of code in it. Those are the findings of placement/layer-direction and
// of the boundary/ rules.
// ──────────────────────────────────────────────────────────────────────

import {
  orderedLayerDirs,
  SOURCE_FILE_GLOB,
  topLevelDirs,
  type TreeVocabulary,
  withoutSourceExtension,
  featureRootModules,
  sourceRootModules,
} from "../../policy/layout.ts";
import {
  collectTreeFiles,
  toProjectPath,
  toSourcePath,
  type Finding,
  type StructuralCheck,
} from "../check-context.ts";

/**
 * The path grammar inside ONE subdivided directory. It is per-directory because
 * `features/` and `domains/` are genuinely different shapes, and the difference
 * is not stylistic — it follows from what the other rules key on.
 *
 * Feature-scoped rules key on `features/<name>/<layer>/`, so a directory inside
 * a feature that is not a layer is reached by nothing and has to be rejected.
 * Domain-scoped rules key on `domains/<name>/` and reach the entire subtree, so
 * a module at a domain root is fully governed and there is nothing for a path to
 * escape into. Applying the feature grammar to domains rejects the layout
 * `directory-model.md` recommends — internal modules at the domain root — which
 * is this rule's own named failure mode.
 *
 * DERIVED from the tree's vocabulary rather than configured. A map an adopting
 * project fills in can be missing an entry, and this check would then pass
 * everything under that directory — a hole needing its own finding to report.
 * Deriving leaves no hole to report: the two subdivided directories are the two
 * the vocabulary names, and each has exactly one grammar.
 */
type BoundaryGrammar =
  | { kind: "layered"; rootFiles: string[]; layers: string[] }
  | { kind: "unlayered" };

function grammarFor(vocabulary: TreeVocabulary, top: string): BoundaryGrammar | undefined {
  if (top === vocabulary.featuresDir) {
    return {
      kind: "layered",
      rootFiles: featureRootModules(vocabulary),
      layers: orderedLayerDirs(vocabulary),
    };
  }
  if (top === vocabulary.domainsDir) return { kind: "unlayered" };
  return undefined;
}

export const topologyCheck: StructuralCheck = {
  id: "placement/topology",
  scope: "tree",

  async run(context) {
    const { config, tree, vocabulary } = context;
    const allowedRoots = topLevelDirs(vocabulary);
    const allowedRootFiles = sourceRootModules(vocabulary);
    const { featuresDir, domainsDir } = vocabulary;
    const sourceRootName = tree.root;

    const layers = allowedRoots.join(", ");
    const findings: Finding[] = [];

    // Compared without extensions, on both sides. The permitted names are
    // MODULES — a barrel is a barrel whether it is spelled `index.ts` or
    // `index.mts` — and `classifyTargetPath` reads `sourceRootModules()` the
    // same way, so a file this check permitted and the import policy called an
    // unpoliced area was the shape the two lists disagreed in.
    const namesModule = (permitted: string[], filename: string): boolean =>
      permitted.some((file) => withoutSourceExtension(file) === withoutSourceExtension(filename));

    // Stylesheets are not modules and are not this rule's subject — where a
    // `.css` file may live is `style/css-tokens`' business, not the path
    // grammar's.
    for (const absolute of collectTreeFiles(context, SOURCE_FILE_GLOB)) {
      const segments = toSourcePath(context, absolute).split("/");
      const file = toProjectPath(config, absolute);
      const report = (message: string) => findings.push({ severity: "error", file, message });

      const [root = "", ...withinRoot] = segments;

      if (withinRoot.length === 0) {
        // Entrypoints and env modules sit directly in the source root and are
        // not layers, so a whitelist of directory names alone rejects them —
        // which is the first thing this rule gets wrong.
        if (namesModule(allowedRootFiles, root)) continue;
        report(
          `\`${root}\` sits directly in ${sourceRootName}/, which holds no layer.\n` +
            `The files that belong there are: ${allowedRootFiles.join(", ")}.\n` +
            `Move this under one of the layers — ${layers} — into whichever one's job it\n` +
            `is doing. If it IS one of this tree's entrypoints or env modules under another\n` +
            `spelling, correct that position's name in \`sourceRootPositions\` or\n` +
            `\`envModules\` where the tree is declared, in lint/policy/declared-trees.ts.\n` +
            `The set of positions is closed: a new KIND of root file is a new role in\n` +
            `SOURCE_ROOT_ROLES in lint/policy/layout.ts, not a name added here.`,
        );
        continue;
      }

      if (!allowedRoots.includes(root)) {
        report(
          `${sourceRootName}/${root} is not a layer, so nothing under it is governed by any\n` +
            `rule in this catalog. The layers are: ${layers}.\n` +
            `Logic that encodes a business rule goes in ${domainsDir}/; anything only one\n` +
            `feature uses belongs inside that feature, under ${featuresDir}/<name>/<layer>/.\n` +
            `If ${root}/ really is a new layer, adding it to this tree's vocabulary is a\n` +
            `decision rather than a file move, and framework-generated output is exempt by\n` +
            `its name.`,
        );
        continue;
      }

      const grammar = grammarFor(vocabulary, root);
      if (grammar === undefined) continue;

      const [name = "", ...withinBoundary] = withinRoot;

      // A file directly in the subdivided directory belongs to no boundary,
      // whatever the boundaries themselves look like: every rule scoped to this
      // directory keys on a boundary name and scopes straight past it.
      if (withinBoundary.length === 0) {
        report(
          `${root}/ subdivides into one directory per boundary, so \`${name}\` belongs to\n` +
            `none of them and every ${root}-scoped rule scopes past it.\n` +
            `Move it into a boundary — ${root}/<name>/ — or into a layer at the source root\n` +
            `if more than one boundary needs it.`,
        );
        continue;
      }

      // An unlayered boundary is governed whole: rules key on `<root>/<name>/`
      // and reach every descendant, so the grammar has nothing left to say and
      // saying it anyway rejects the layout the directory model recommends.
      if (grammar.kind === "unlayered") continue;

      const boundaryLayers = grammar.layers.map((dir) => `${dir}/`).join(", ");
      const next = withinBoundary[0] ?? "";

      if (withinBoundary.length === 1) {
        if (namesModule(grammar.rootFiles, next)) continue;
        report(
          `A file at a ${root} root is outside every layer, so no layer rule governs it.\n` +
            `${root}/${name}/ holds ${grammar.rootFiles.join(", ")} and nothing else.\n` +
            `Move this into ${boundaryLayers} — whichever layer's job it is doing.\n` +
            `If it IS this tree's declared root position under another spelling, correct\n` +
            `that name in \`featureRootPositions\` where the tree is declared, in\n` +
            `lint/policy/declared-trees.ts. The set of positions is closed: a new KIND of\n` +
            `root file is a new role in FEATURE_ROOT_ROLES in lint/policy/layout.ts, not a\n` +
            `name added here.`,
        );
        continue;
      }

      if (!grammar.layers.includes(next)) {
        report(
          `${next}/ is not a layer inside ${root}/${name}, so nothing under it is governed\n` +
            `by a layer rule. The layers are: ${boundaryLayers}\n` +
            `Move these files into whichever layer's job they are doing, or split ${next}/\n` +
            `out into a boundary of its own if it has grown into one.`,
        );
      }
    }

    return findings;
  },
};
