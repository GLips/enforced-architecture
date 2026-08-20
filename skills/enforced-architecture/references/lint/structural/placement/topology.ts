// ─── placement/topology ───────────────────────────────────────────────
//
// Makes sure: Each .ts and .tsx file under the source root is at a path that a
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
  collectFiles,
  toProjectPath,
  toSourcePath,
  type Finding,
  type StructuralCheck,
} from "../check-substrate.ts";

export const topologyCheck: StructuralCheck = {
  id: "placement/topology",

  run({ config }) {
    const { allowedRoots, allowedRootFiles, boundaries } = config.checks["placement/topology"];
    const { subdividedDirs, featuresDirName, domainsDirName } = config.source;
    const sourceRootName = config.source.roots[0];

    const layers = allowedRoots.join(", ");
    const findings: Finding[] = [];

    // A subdivided directory with no grammar is a hole in the whitelist, and a
    // whitelist with a hole in it reports clean over exactly the paths it cannot
    // describe. Said once, against the config, rather than per file.
    for (const dir of subdividedDirs) {
      if (boundaries[dir] !== undefined) continue;
      findings.push({
        severity: "error",
        file: `${sourceRootName}/${dir}`,
        message:
          `${dir}/ subdivides into boundaries but has no entry in \`boundaries\`, so this\n` +
          `check cannot say what belongs inside one and passes everything under it.\n` +
          `Add a grammar for ${dir} to \`placement/topology\` in the architecture config —\n` +
          `\`layered\` when rules key on ${dir}/<name>/<layer>/, \`unlayered\` when they key\n` +
          `on ${dir}/<name>/ and reach the whole subtree.`,
      });
    }

    // Stylesheets are not modules and are not this rule's subject — where a
    // `.css` file may live is `style/css-tokens`' business, not the path
    // grammar's.
    for (const absolute of collectFiles(config, "", "**/*.{ts,tsx}", { fromSourceRoot: true })) {
      const segments = toSourcePath(config, absolute).split("/");
      const file = toProjectPath(config, absolute);
      const report = (message: string) => findings.push({ severity: "error", file, message });

      const [root = "", ...withinRoot] = segments;

      if (withinRoot.length === 0) {
        // Entrypoints and env modules sit directly in the source root and are
        // not layers, so a whitelist of directory names alone rejects them —
        // which is the first thing this rule gets wrong.
        if (allowedRootFiles.includes(root)) continue;
        report(
          `\`${root}\` sits directly in ${sourceRootName}/, which holds no layer.\n` +
            `The files that belong there are: ${allowedRootFiles.join(", ")}.\n` +
            `Move this under one of the layers — ${layers} — into whichever one's job it\n` +
            `is doing. If it genuinely is an entrypoint or an env module, add its name to\n` +
            `\`allowedRootFiles\` in the project's architecture config.`,
        );
        continue;
      }

      if (!allowedRoots.includes(root)) {
        report(
          `${sourceRootName}/${root} is not a layer, so nothing under it is governed by any\n` +
            `rule in this catalog. The layers are: ${layers}.\n` +
            `Logic that encodes a business rule goes in ${domainsDirName}/; anything only one\n` +
            `feature uses belongs inside that feature, under ${featuresDirName}/<name>/<layer>/.\n` +
            `If ${root}/ really is a new layer, adding it to \`allowedRoots\` is a decision\n` +
            `rather than a file move, and framework-generated output belongs in the global\n` +
            `exclusions instead.`,
        );
        continue;
      }

      const grammar = boundaries[root];
      if (!subdividedDirs.includes(root) || grammar === undefined) continue;

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
        if (grammar.rootFiles.includes(next)) continue;
        report(
          `A file at a ${root} root is outside every layer, so no layer rule governs it.\n` +
            `${root}/${name}/ holds ${grammar.rootFiles.join(", ")} and nothing else.\n` +
            `Move this into ${boundaryLayers} — whichever layer's job it is doing.\n` +
            `If every ${root} boundary needs a file by this name, it goes in the \`rootFiles\`\n` +
            `of that boundary's grammar.`,
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
