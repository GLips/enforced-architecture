// ─── health/trampolines ───────────────────────────────────────────────
//
// Shows: each exported function in a target layer whose body has no variable,
// no branch, and no try or throw. Such a function usually only forwards a call,
// so you delete it or you write `export { repoFn as serviceFn }`. Then a change
// to the repo function is an edit to one file, not two.
//
// The layer, and not the body text, decides the result. The same body is a finding
// under service/ and correct under repo/, where a thin wrapper on a query is the
// job. Thus the check walks layer roots, and repo is never a target layer.
//
// This reads two forms: `export function` and a method of an exported object
// literal. It does not read an exported arrow function
// (`export const name = () => …`). Add that shape here if it appears. A form
// the extractor does not find gets no finding, and a reader then believes the
// file is correct.
// ──────────────────────────────────────────────────────────────────────

import { SOURCE_FILE_GLOB } from "../../policy/layout.ts";
import {
  matchingBrace,
  blankComments,
  collectTreeFiles,
  lineNumberAt,
  lineStartOffsets,
  readFile,
  stripCommentsAndStrings,
  toProjectPath,
  type Finding,
  type StructuralCheck,
} from "../check-substrate.ts";

/**
 * The tokens that mean a body DOES something beyond forwarding: a binding, a
 * branch, a loop, a throw.
 *
 * Fixed, and that is the difference between a knob and an off-switch. What
 * counts as behaviour is this check's entire claim — `behaviorKeywords: /.*\/`
 * as a config field took the trampoline findings in this repo's own fixtures
 * from four to zero while the check still read as enabled. Which LAYERS are
 * scanned stays configurable, because that is a name.
 *
 * Do not add `return`. A function that only returns another function's result is
 * the subject of this check, and with `return` here it reports nothing at all.
 */
const BEHAVIOR_KEYWORDS = /\b(const|let|var|if|for|while|switch|try|throw|catch)\b/;

/** `export function name` at the start of a line, which is the only place a real one sits. */
const EXPORTED_FUNCTION = /^[ \t]*export\s+(?:default\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/gm;

/**
 * `export const name = {` — the object whose METHODS are the second half of the
 * subject. A service written as one exported namespace is common enough that an
 * implementation reading only `export function` is silent on most of a codebase.
 */
const EXPORTED_OBJECT = /^[ \t]*export\s+const\s+[A-Za-z_$][\w$]*\s*(?::[^=\n]+)?=\s*\{/gm;

/**
 * A method head inside an object literal. The leading `{` or `,` is what makes
 * it a member rather than a call; the prefix is captured separately so the
 * name's offset is arithmetic rather than a search that `async` could confuse.
 */
const OBJECT_METHOD = /([{,]\s*(?:async\s+)?)([A-Za-z_$][\w$]*)\s*\(/g;

type ExportedFunction = { name: string; line: number; body: string };

export const trampolinesCheck: StructuralCheck = {
  id: "health/trampolines",
  scope: "tree",

  async run(context) {
    const { config, vocabulary } = context;
    const { targetLayerRoles } = config.checks["health/trampolines"];
    const findings: Finding[] = [];

    for (const role of targetLayerRoles) {
      const layer = vocabulary.featureLayerDirs[role];
      const under = `${vocabulary.featuresDir}/*/${layer}`;
      for (const absolute of collectTreeFiles(context, SOURCE_FILE_GLOB, { under })) {
        // Block comments go first so prose cannot spell a keyword the body does
        // not have; the per-line pass then empties strings, which is what the
        // brace and paren walks below need.
        const scrubbed = blankComments(readFile(absolute))
          .split("\n")
          .map(stripCommentsAndStrings)
          .join("\n");

        for (const { name, line, body } of exportedFunctions(scrubbed)) {
          if (BEHAVIOR_KEYWORDS.test(body)) continue;

          findings.push({
            severity: "warning",
            file: toProjectPath(config, absolute),
            line,
            message:
              `likely trampoline: ${name}() forwards a call without adding validation,\n` +
              `orchestration, error handling, or transformation.\n` +
              `Delete the wrapper and call the underlying function directly, or re-export it\n` +
              `(export { repoFn as serviceFn } from "../repo/x") if the layer has to carry the\n` +
              `name. If it is intentional — a stable seam for testing, or about to grow — no\n` +
              `action is needed.`,
          });
        }
      }
    }

    return findings;
  },
};

/**
 * Every exported function in `scrubbed`, in the two forms a service is written
 * in: a top-level declaration, and a method of an exported object literal.
 *
 * `scrubbed` must already have comments and strings blanked, and must be the
 * SAME SHAPE as the file on disk line-for-line, because the reported line comes
 * from an offset into it.
 */
function exportedFunctions(scrubbed: string): ExportedFunction[] {
  const depths = braceDepths(scrubbed);
  const lineStarts = lineStartOffsets(scrubbed);
  const found: ExportedFunction[] = [];

  for (const match of scrubbed.matchAll(EXPORTED_FUNCTION)) {
    const body = bodyAfter(scrubbed, match.index + match[0].length);
    if (body === undefined || match[1] === undefined) continue;
    found.push({ name: match[1], line: lineNumberAt(lineStarts, match.index), body });
  }

  for (const object of scrubbed.matchAll(EXPORTED_OBJECT)) {
    const open = object.index + object[0].length - 1;
    const close = matchingBrace(scrubbed, open);
    if (close === -1) continue;

    for (const method of scrubbed.slice(open, close).matchAll(OBJECT_METHOD)) {
      const name = method[2];
      const at = open + method.index + (method[1]?.length ?? 0);
      // Direct members only. A method of a nested object literal belongs to
      // whatever holds it, not to the exported surface.
      if (name === undefined || depths[at] !== depths[open] + 1) continue;

      const body = bodyAfter(scrubbed, at + name.length);
      if (body === undefined) continue;
      found.push({ name, line: lineNumberAt(lineStarts, at), body });
    }
  }

  return found;
}

/**
 * What follows a balanced `{…}` group that was part of a return type rather
 * than the body: the body's own brace, a union or intersection, an index
 * signature, or the close of a `Array<…>`. The body's closing brace is followed
 * by none of these, which is what separates the two.
 */
const RETURN_TYPE_CONTINUES = /^\s*[{|&>[]/;

/**
 * The text between the braces of the body whose signature starts at `from`,
 * which is just past the function's name.
 *
 * Paren depth is tracked rather than the line scanned, because a signature that
 * spans lines is exactly the shape a line-oriented matcher loses the boundary
 * of — and the long signatures are the ones on functions worth reading.
 *
 * A `{` inside a type-parameter list is deliberately not handled and reads as
 * the body. A return type that is an object literal IS handled: reading
 * `): { ok: boolean } {` as a body means testing a type for behaviour keywords
 * and reporting a function that has them, which is the over-match that teaches
 * people to ignore the check.
 */
function bodyAfter(scrubbed: string, from: number): string | undefined {
  let parens = 0;
  let inReturnType = false;

  for (let i = from; i < scrubbed.length; i++) {
    const ch = scrubbed[i];
    if (ch === "(") parens++;
    else if (ch === ")") parens--;
    else if (parens > 0) continue;
    // An overload signature has no body, and swallowing the next declaration's
    // would report a function whose text is not its own.
    else if (ch === ";") return undefined;
    else if (ch === ":") inReturnType = true;
    else if (ch === "{") {
      const close = matchingBrace(scrubbed, i);
      if (close === -1) return undefined;
      if (inReturnType && RETURN_TYPE_CONTINUES.test(scrubbed.slice(close + 1))) {
        i = close;
        continue;
      }
      return scrubbed.slice(i + 1, close);
    }
  }

  return undefined;
}

/**
 * Brace depth at each offset. An opening brace carries the depth OUTSIDE it and
 * so does its match, so a direct member of a block sits exactly one deeper than
 * the brace that opened it.
 */
function braceDepths(scrubbed: string): number[] {
  const depths: number[] = new Array(scrubbed.length);
  let depth = 0;

  for (let i = 0; i < scrubbed.length; i++) {
    if (scrubbed[i] === "}") depth--;
    depths[i] = depth;
    if (scrubbed[i] === "{") depth++;
  }

  return depths;
}
