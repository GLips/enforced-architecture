// ─── The component-declaration classifier ─────────────────────────────
//
// Shared by `react/hook-count`, `react/prop-count`, and
// `react/single-component-export`. Written once because the hard part is the
// same for all three and the failure mode is the same too: a declaration form
// the classifier does not recognise is a component the check never reports on,
// and silence reads as a pass.
//
// The forms are one thing to a reader and separate cases to every
// implementation: `export function Name()`, `export default function`, a generic
// `export function Name<T>()`, an arrow assigned to a `const`, `memo(…)`, and
// `forwardRef(…)`. Cover the first and the rest are ignored in silence — and the
// ignored forms carry the smell, because the component tucked in beside another
// one is usually the small arrow, not the exported function declaration.
//
// Two blind spots are worth naming because both were live defects:
//
//   - **The generic type-parameter list sits between the name and the paren**
//     (`export function OptionList<T extends string>({ items })`). A pattern
//     expecting them adjacent never matches the declaration line and skips the
//     whole component.
//   - **A real signature spans lines.** Capturing the parameter list inline as
//     `\(([^)]*)\)` needs the whole signature on one line, which found 32 of one
//     repo's 121 components — precisely the small ones, the only ones that could
//     never breach an 8-prop threshold. It was green the entire time.
//
// ──────────────────────────────────────────────────────────────────────

/**
 * `export function Name(` — including `default`, `async`, and the generic
 * type-parameter list. The match ends at the opening paren of the parameter list.
 */
const FUNCTION_DECLARATION =
  /^\s*export\s+(?:default\s+)?(?:async\s+)?function\s+([A-Z]\w*)\s*(?:<[^(;]*>)?\s*\(/;

/**
 * `export const Name = (` and its wrapper spellings.
 *
 * The bound VALUE is tested, not just the name. A PascalCase const is very often
 * not a component — `export const AllComponentsCtx = createContext(…)` and
 * `export const DRAG_SLOP = 4` both pass a name-only test, and reporting those
 * trains people to ignore the rule, which costs more than the smell it was
 * watching for. This over-matching is invisible to every positive fixture; only
 * the legal neighbour catches it.
 */
const CONST_DECLARATION =
  /^\s*export\s+const\s+([A-Z][a-zA-Z0-9]*)\s*(?::[^=]+)?=\s*(?:async\s*)?(?:<[^(;]*>\s*)?(\(|function\b|forwardRef\b|memo\b|React\.memo\b)/;

/** After the closing paren, an arrow component must actually have its `=>`. */
const ARROW_TAIL = /^\s*(?::[^=]*)?=>/;

/**
 * A signature this long is a runaway, not a component: the walk gave up because
 * the file has unbalanced parens — a template literal, most likely.
 */
const MAX_SIGNATURE_LINES = 60;

export type ComponentDeclaration = {
  name: string;
  /** 0-based index into the line array handed to `findComponentDeclarations`. */
  index: number;
  /** 1-based, for findings. */
  line: number;
  /**
   * `declaration` for `export function Name(`, `arrow` for `export const Name = (…) =>`,
   * `wrapper` for a `memo`/`forwardRef`/function-expression binding.
   */
  kind: "declaration" | "arrow" | "wrapper";
  /**
   * The parameter list and whatever follows its closing paren. Null when the
   * paren never closes within `MAX_SIGNATURE_LINES` — which is a finding, not a
   * reason to skip quietly. For `wrapper` this is the wrapper call's arguments,
   * not the component's props.
   */
  signature: { params: string; tail: string } | null;
};

/**
 * Every exported component declaration in `code`.
 *
 * `code` must already have comments and strings blanked per line (see
 * `stripCommentsAndStrings`), because the paren and brace walks below would
 * otherwise be thrown off by a paren inside a string or a trailing comment.
 */
export function findComponentDeclarations(code: string[]): ComponentDeclaration[] {
  const found: ComponentDeclaration[] = [];

  for (let index = 0; index < code.length; index++) {
    const line = code[index] ?? "";

    const declaration = FUNCTION_DECLARATION.exec(line);
    if (declaration?.[1] !== undefined) {
      found.push({
        name: declaration[1],
        index,
        line: index + 1,
        kind: "declaration",
        signature: readSignature(code, index, declaration[0].length),
      });
      continue;
    }

    const bound = CONST_DECLARATION.exec(line);
    if (bound?.[1] === undefined) continue;

    if (bound[2] !== "(") {
      found.push({ name: bound[1], index, line: index + 1, kind: "wrapper", signature: null });
      continue;
    }

    const signature = readSignature(code, index, bound[0].length);
    // An unreadable signature stays: the caller decides whether to report it.
    // A readable one with no `=>` after the closing paren is a parenthesised
    // expression bound to a PascalCase const, not a component.
    if (signature !== null && !ARROW_TAIL.test(signature.tail)) continue;
    found.push({ name: bound[1], index, line: index + 1, kind: "arrow", signature });
  }

  return found;
}

/**
 * Walk forward from an opening paren, collecting the parameter list until paren
 * depth returns to zero. `openOffset` is the offset just past the `(` on line
 * `start`. Returns the list and whatever follows the closing paren on its line,
 * which is where an arrow component's `=>` lives.
 */
function readSignature(
  code: string[],
  start: number,
  openOffset: number,
): { params: string; tail: string } | null {
  let depth = 1;
  let params = "";

  for (let i = start; i < code.length && i - start < MAX_SIGNATURE_LINES; i++) {
    const line = code[i] ?? "";
    for (let j = i === start ? openOffset : 0; j < line.length; j++) {
      const ch = line[j];
      if (ch === "(") depth++;
      else if (ch === ")" && --depth === 0) return { params, tail: line.slice(j + 1) };
      params += ch;
    }
    params += "\n";
  }

  return null;
}

/**
 * The body lines of the declaration starting at `start`, found by brace depth
 * rather than by a parser, plus the index of the line that closed it.
 */
export function readComponentBody(
  code: string[],
  start: number,
): { body: string[]; endIndex: number } {
  let depth = 0;
  let opened = false;
  const body: string[] = [];

  for (let i = start; i < code.length; i++) {
    for (const ch of code[i] ?? "") {
      if (ch === "{") {
        depth++;
        opened = true;
      } else if (ch === "}") depth--;
    }
    if (i > start) body.push(code[i] ?? "");
    if (opened && depth <= 0) return { body, endIndex: i };
  }

  return { body, endIndex: code.length - 1 };
}

/** Index of the `}` closing the `{` at `open`, or -1 if it is never closed. */
export function matchingBrace(code: string, open: number): number {
  let depth = 0;
  for (let i = open; i < code.length; i++) {
    if (code[i] === "{") depth++;
    else if (code[i] === "}" && --depth === 0) return i;
  }
  return -1;
}
