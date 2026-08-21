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
// The word boundaries in the two patterns are necessary. `shadowRoot`, a
// `data-shadow` attribute and a `.shadow-panel` class name are all correct code.
// A wider pattern fails a commit on correct code, and then people disable the
// check.
//
// Do not add an escape for a `styles` or an `sx` prop. A person asks for it
// about one week after you add this rule. If a component can write a shadow
// through a prop, the file is no longer the complete list. No person can
// test the first sentence by a read of one file.
//
// Keep the severity at error. With a warning, the number of violations
// increases, and the file that people still name as the complete list is not
// complete.
//
// NEGATIVE SPACE: the two spellings are the WEB ones. A React Native project
// writes `shadowColor` / `shadowOffset` / `shadowRadius`, and this check says
// nothing about any of them — the file it names as the complete inventory is
// complete for `box-shadow` and `boxShadow` alone. Adding those spellings is a
// change to this catalog, not a config field: what counts as a shadow IS this
// check, and as a regex knob it was one `/a^/` away from reporting nothing while
// still reading as enabled.
// ──────────────────────────────────────────────────────────────────────

import { SOURCE_EXTENSIONS } from "../../policy/layout.ts";
import {
  blankComments,
  collectTreeFiles,
  readFile,
  toProjectPath,
  toSourcePath,
  type Finding,
  type StructuralCheck,
} from "../check-substrate.ts";

// Which of the two spellings to look for is decided by `SOURCE_EXTENSIONS`:
// anything it names is a module and gets `boxShadow`, everything else scanned is
// a stylesheet and gets `box-shadow`. That is a fact about the languages rather
// than about a project — a stylesheet has no `boxShadow` key — so it is not a
// knob, and it is read from the shared list rather than restated: a second copy
// here drifts SILENTLY and in one direction, classifying newly-added source
// extensions as stylesheets and reporting them clean.
//
// The scan itself takes every stylesheet extension the tree declares plus every
// source extension the catalog knows, so "what is read" is not a knob either: a
// list of scanned extensions can be emptied, and an empty one is a check that
// walks nothing and reports clean.

/** The stylesheet spelling. */
const STYLESHEET_SHADOW = /\bbox-shadow\b/;

/** The script spelling — the JS property key, which no stylesheet can carry. */
const SCRIPT_SHADOW = /\bboxShadow\b/;

export const shadowSourceCheck: StructuralCheck = {
  id: "style/shadow-source",
  scope: "tree",

  async run(context) {
    const { config, vocabulary } = context;
    const { allowedFile } = config.checks["style/shadow-source"];
    const findings: Finding[] = [];

    const scanned = [...vocabulary.stylesheetExtensions, ...SOURCE_EXTENSIONS];
    for (const absolute of collectTreeFiles(context, `**/*.{${scanned.join(",")}}`)) {
      // The curated home is the one file permitted to hold a shadow. Without
      // this skip the rule fires on its own inventory and has nowhere left to
      // send people.
      if (toSourcePath(context, absolute) === allowedFile) continue;

      const extension = absolute.slice(absolute.lastIndexOf(".") + 1);
      const pattern = SOURCE_EXTENSIONS.includes(extension) ? SCRIPT_SHADOW : STYLESHEET_SHADOW;

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
