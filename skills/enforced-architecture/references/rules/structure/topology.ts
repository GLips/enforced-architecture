// ─── structure/topology ───────────────────────────────────────────────
//
// Tag:       structure
// Mechanism: structural script (filesystem walk)
// Blocking:  Yes
//
// Prevents:  A file living somewhere no rule looks. Every other rule in the
//            catalog keys on a path pattern, so a path matching none of them is
//            governed by nothing. Enforcement built on path patterns has to
//            close the set of paths, or it is enforcement on the paths that
//            happened to be there when it was written.
//
// A whitelist, because the failure is the unlisted case. Every message is a
// DESTINATION rather than a refusal: this rule fires when someone had nowhere
// obvious to put something, and a refusal leaves them exactly where they were.
// See structure/topology.md.
//
// ──────────────────────────────────────────────────────────────────────

import {
  collectFiles,
  toProjectPath,
  toSourcePath,
  type Finding,
  type StructuralCheck,
} from "../scripts/lib.ts";

export const topologyCheck: StructuralCheck = {
  id: "structure/topology",

  run({ config }) {
    const { allowedRoots, allowedRootFiles, boundaries } = config.checks["structure/topology"];
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
          `Add a grammar for ${dir} to \`structure/topology\` in the architecture config —\n` +
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
