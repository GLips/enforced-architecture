// ─── style/shadow-source ──────────────────────────────────────────────
//
// Tag:       style
// Mechanism: structural check (a surface the linter cannot see)
// Blocking:  Yes
//
// Prevents:  Elevation being invented at the call site. Every shadow in the
//            codebase lives in ONE curated file, so the set of shadows anyone
//            has to review is one screen long rather than the whole tree.
//
// The pattern is chosen BY SURFACE: the CSS property spelling in stylesheets,
// the JS key spelling in modules. Two branches, one per surface — a case
// covering one of them says nothing about the other, and the branch that goes
// unexercised is the one that silently stops matching.
//
// See style/shadow-source.md for the React Native spelling, and for why a
// `styles` / `sx` escape hatch is the one adjustment that ends the rule.
//
// ──────────────────────────────────────────────────────────────────────

import {
  blankComments,
  collectSourceFiles,
  readFile,
  toProjectPath,
  toSourcePath,
  type Finding,
  type StructuralCheck,
} from "../check-substrate.ts";

/**
 * Extensions the JS spelling applies to; everything else scanned is a
 * stylesheet. This is a fact about the languages rather than about a project —
 * a stylesheet has no `boxShadow` key and a module has no `box-shadow`
 * property — so it is not a knob. `scannedExtensions` decides what is read;
 * this decides which of the two spellings is looked for.
 */
const SCRIPT_EXTENSIONS = ["ts", "tsx", "mts", "cts", "js", "jsx", "mjs", "cjs"];

export const shadowSourceCheck: StructuralCheck = {
  id: "style/shadow-source",

  run({ config }) {
    const { allowedFile, scannedExtensions, stylesheetPattern, scriptPattern } =
      config.checks["style/shadow-source"];
    const findings: Finding[] = [];

    for (const absolute of collectSourceFiles(config, `**/*.{${scannedExtensions.join(",")}}`)) {
      // The curated home is the one file permitted to hold a shadow. Without
      // this skip the rule fires on its own inventory and has nowhere left to
      // send people.
      if (toSourcePath(config, absolute) === allowedFile) continue;

      const extension = absolute.slice(absolute.lastIndexOf(".") + 1);
      const pattern = SCRIPT_EXTENSIONS.includes(extension) ? scriptPattern : stylesheetPattern;

      // Blanked rather than stripped: the reported line is an index into this
      // array, so it is only true while the blanked copy has the same shape as
      // the file on disk.
      const lines = blankComments(readFile(absolute)).split("\n");

      for (const [index, line] of lines.entries()) {
        // Matched rather than tested so the message can name the spelling that
        // fired. On React Native the pattern is an alternation of five
        // properties, and "which one" is the first thing the reader wants.
        const match = line.match(pattern);
        if (match === null) continue;

        findings.push({
          severity: "error",
          file: toProjectPath(config, absolute),
          line: index + 1,
          message:
            `${match[0]} outside ${allowedFile}.\n` +
            `Add a named entry to that file — the curated shadow inventory — and apply it\n` +
            `by name instead of writing the property here. The claim this protects is\n` +
            `binary: one unreviewed shadow anywhere else and "every shadow in this\n` +
            `codebase is in one file" stops being true.`,
        });
      }
    }

    return findings;
  },
};
