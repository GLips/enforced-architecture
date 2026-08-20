// ─── style/css-tokens ─────────────────────────────────────────────────
//
// Makes sure: Every color and font-size value in a stylesheet is a token
// reference or a token definition. You change a color or a size in the token
// source, and no `.css` file keeps the old value. To add a dark theme, you do
// not first read every stylesheet for raw values.
//
// style/no-inline-color and style/no-inline-font-size do not make this check
// unnecessary. The oxlint JS plugins receive JavaScript and TypeScript files
// only. A `.css` file never reaches them, so both lint rules stay green while
// `font-size: 13px` sits in a CSS module.
//
// Do not add `em` or `%` to the font-size matcher. They are relative units, and
// an absolute scale holds no token for "1.3 times the text around it". A check
// with no fix to name is a check that people turn off.
//
// Do not add spacing here. style/token-equality checks spacing, because it
// imports the project's real scale. This check holds no scale and can only
// guess which lengths are on one. style/shadow-source checks `box-shadow`, so
// one violation gives one message and not two.
//
// The tree's token stylesheet is the one exempt file, because it DEFINES the
// scales. Per-line suppression is absent on purpose. A value no token can
// express is a gap in the scale, not a false positive to silence.
// ──────────────────────────────────────────────────────────────────────

import { stylesheetGlob } from "../../policy/layout.ts";
import {
  collectTreeFiles,
  lineNumberAt,
  lineStartOffsets,
  readFile,
  toProjectPath,
  toSourcePath,
  type Finding,
  type StructuralCheck,
} from "../check-substrate.ts";

// A hex literal (#rgb / #rrggbb / #rrggbbaa) or a color function used as a
// value. The function forms require a literal digit inside the parens, which is
// what lets `rgb(var(--brand-channels))` through: a token reference carries no
// digit of its own, so only a hand-written channel matches.
const RAW_COLOR = /#[0-9a-fA-F]{3,8}\b|(?:rgb|rgba|hsl|hsla)\([^)]*[0-9]/;

// A `font-size` whose value carries an ABSOLUTE length literal. `em` and `%` are
// deliberately absent — see the doc; there is no token an absolute scale can
// offer for "1.3× the surrounding text", and a rule with no fix to suggest is
// one agents learn to route around.
const RAW_FONT_SIZE = /\bfont-size\s*:\s*[^;{}]*\b[\d.]+(?:px|rem|pt)\b/;

// A custom-property DEFINITION. Matched by SHAPE rather than by file because a
// token declaration must assign a raw value wherever it lives, so the check
// stays right if a token moves out of the token source. A `var(--x)` REFERENCE
// is a value, not a declaration, and never starts the declaration it sits in.
const CUSTOM_PROP_DEF = /^\s*--[\w-]+\s*:/;

export const cssTokensCheck: StructuralCheck = {
  id: "style/css-tokens",
  scope: "tree",

  run(context) {
    const { config, vocabulary } = context;
    const findings: Finding[] = [];

    for (const absolute of collectTreeFiles(context, stylesheetGlob(vocabulary))) {
      // The token source DEFINES the raw values, which is what a token is. It is
      // exempt whole, because a global stylesheet also carries base rules
      // (`body { color: … }`) that the by-shape skip above does not cover.
      if (toSourcePath(context, absolute) === vocabulary.tokenStylesheetName) continue;

      const file = toProjectPath(config, absolute);
      const source = blankCssComments(readFile(absolute));
      const lineStarts = lineStartOffsets(source);

      for (const declaration of cssDeclarations(source)) {
        if (CUSTOM_PROP_DEF.test(declaration.text)) continue;

        const color = RAW_COLOR.exec(declaration.text);
        if (color !== null) {
          findings.push({
            severity: "error",
            file,
            line: lineNumberAt(lineStarts, declaration.offset + color.index),
            message:
              `Raw color value in CSS: ${color[0]}.\n` +
              `Reference a color token — \`color: var(--color-text-secondary)\` — so light\n` +
              `and dark stay in sync. The lint tier enforces this on the JS/TS surface and\n` +
              `cannot read this file, so a raw value here is the one that survives review.`,
          });
        }

        const fontSize = RAW_FONT_SIZE.exec(declaration.text);
        if (fontSize !== null) {
          findings.push({
            severity: "error",
            file,
            line: lineNumberAt(lineStarts, declaration.offset + fontSize.index),
            message:
              `Raw font-size in CSS.\n` +
              `Reference the type scale — \`font-size: var(--text-body)\` — so the size stays\n` +
              `on the scale the token source defines. Relative units (\`em\`, \`%\`) are left\n` +
              `alone on purpose: no absolute token can express them.`,
          });
        }
      }
    }

    return findings;
  },
};

/**
 * Comments replaced by spaces, newlines kept, so every reported line stays true.
 *
 * Not `lib.blankComments`: that one also blanks `//` to end of line, which is
 * not a comment in CSS and would swallow the rest of any line carrying a
 * `url(https://…)`.
 */
function blankCssComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "));
}

/**
 * Each declaration in a stylesheet, with the offset it starts at.
 *
 * Declarations rather than lines, because a line is not the unit CSS is written
 * in: a value wrapped onto the line after its property (`font-size:\n  13px;`)
 * is invisible to a line-oriented matcher, which sees a property with no unit
 * and then a unit with no property. That is `react/prop-count`'s
 * `\(([^)]*)\)` — green for as long as every case it could catch happened to fit
 * on one line.
 *
 * A span ending at `{` is a selector or an at-rule prelude, never a declaration.
 * Skipping those is also what keeps an id selector (`#abcdef {`) out of the
 * color matcher.
 */
function* cssDeclarations(source: string): Generator<{ text: string; offset: number }> {
  let start = 0;
  for (let at = 0; at < source.length; at++) {
    const char = source[at];
    if (char !== ";" && char !== "{" && char !== "}") continue;
    if (char !== "{") yield { text: source.slice(start, at), offset: start };
    start = at + 1;
  }
}
