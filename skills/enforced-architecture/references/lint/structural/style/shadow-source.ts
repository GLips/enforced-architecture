// ─── style/shadow-source ──────────────────────────────────────────────
//
// Makes sure: Only one file declares a shadow: the file that `allowedFile`
// names. To change how a shadow looks, you edit one named entry in that file.
// To see all of the shadows in the project, you read that one file and not
// each stylesheet and each component.
//
// Do not move this check to the lint tier. oxlint does not parse a .css file,
// and a stylesheet is where most shadows are. A rule that reads only the .tsx
// files reports nothing about the stylesheets, and the sentence above becomes
// false.
//
// The word boundaries in `stylesheetPattern` and `scriptPattern` are
// necessary. `shadowRoot`, a `data-shadow` attribute and a `.shadow-panel`
// class name are all correct code. A wider pattern fails a commit on correct
// code, and then people disable the check.
//
// Do not add an escape for a `styles` or an `sx` prop. A person asks for it
// about one week after you add this rule. If a component can write a shadow
// through a prop, the file is no longer the complete list. No person can
// test the first sentence by a read of one file.
//
// Keep the severity at error. With a warning, the number of violations
// increases, and the file that people still name as the complete list is not
// complete.
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
