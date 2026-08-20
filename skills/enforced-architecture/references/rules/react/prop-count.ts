// ─── react/prop-count ─────────────────────────────────────────────────
//
// Tag:       react
// Mechanism: structural script (counts across a file set)
// Blocking:  No — a warning. A wide prop surface is a smell, and the developer
//            decides whether decomposition or the current interface is right.
//
// Prevents:  Components with a prop surface wide enough to be hard to use
//            correctly — usually a component doing too much, props that always
//            travel together, or data drilled through an intermediary.
//
// A base type is followed. `type XProps = Model & { onThing }` and
// `interface XProps extends Model { onThing }` declare most of their surface to
// the LEFT of the brace, and they are the spelling a component reaches for once
// that surface is wide — so a reader that takes only the members between the
// braces goes quiet at exactly the size it exists to report.
//
// AN UNRESOLVED BASE CONTRIBUTES NOTHING AND THE COUNT BECOMES A FLOOR. A base
// declared in another file cannot be read from this one, and the check says so
// in the finding — "at least N props", naming the type — rather than either
// staying silent or refusing to count. The alternative, reporting every
// component whose base is imported, would put a permanent unactionable warning
// on every `extends ViewProps` in the codebase, which is the defect that teaches
// people to scroll past a check. The floor is the conservative half: it can miss
// a wide component, never invent one.
//
// See react/prop-count.md for why there are two counting strategies and for the
// five ways this check has gone silent.
//
// ──────────────────────────────────────────────────────────────────────

import {
  findComponentDeclarations,
  matchingBrace,
} from "../scripts/component-declarations.ts";
import type { ArchitectureConfig } from "../scripts/config.ts";
import {
  blankComments,
  collectFiles,
  readFile,
  splitTopLevel,
  stripCommentsAndStrings,
  toProjectPath,
  type Finding,
  type StructuralCheck,
} from "../scripts/lib.ts";

/** A property signature, and its name. Method signatures deliberately do not match. */
const PROPS_MEMBER = /^(?:readonly\s+)?([A-Za-z_$][\w$]*)\??\s*:/;

/** A type name at the head of an intersection term or a heritage entry. */
const TYPE_REFERENCE = /^[A-Za-z_$][\w$]*(?:\s*\.\s*[A-Za-z_$][\w$]*)*/;

/**
 * Characters that mean the term is not a plain reference to a named type:
 * an indexed access, a conditional, a call or constructor signature, a union.
 * Reading `Model["field"]` as `Model` would add every member of `Model` for a
 * prop surface that borrowed exactly one of them.
 */
const NOT_A_PLAIN_REFERENCE = "[?(|=>";

/**
 * What a Props type declares: the distinct member names, and whether the check
 * managed to read the whole of it.
 */
type PropSurface = {
  names: Set<string>;
  /** False once any part of the type could not be read. `names` is then a floor. */
  complete: boolean;
  /** Base types the check could not read out of this file, named for the finding. */
  unresolved: string[];
};

export const propCountCheck: StructuralCheck = {
  id: "react/prop-count",

  run({ config }) {
    const { targetDirs, threshold } = config.checks["react/prop-count"];
    // Deduplicated because two target globs may resolve to the same file, and a
    // component reported twice reads as two components.
    const files = new Set(
      targetDirs.flatMap((dir) =>
        collectFiles(config, dir, "**/*.tsx", { fromSourceRoot: true }),
      ),
    );

    return [...files].sort().flatMap((absolute) => scanFile(config, absolute, threshold));
  },
};

function scanFile(
  config: ArchitectureConfig,
  absolute: string,
  threshold: number,
): Finding[] {
  const file = toProjectPath(config, absolute);
  // Block comments blanked before the per-line strip, so neither walk below can
  // be thrown off by a brace or paren inside a comment or a string. Blanking
  // rather than stripping keeps every reported line number true to the file.
  const code = blankComments(readFile(absolute)).split("\n").map(stripCommentsAndStrings);
  const source = code.join("\n");
  const findings: Finding[] = [];

  for (const component of findComponentDeclarations(code)) {
    // A wrapper's signature is the `memo`/`forwardRef` call's arguments; the
    // props belong to the function inside it, which is found on its own line.
    if (component.kind === "wrapper") continue;

    if (component.signature === null) {
      findings.push({
        severity: "error",
        file,
        line: component.line,
        message:
          `Could not read ${component.name}'s parameter list: the paren never closes.\n` +
          `prop-count is blind to this component until that is resolved, and a component\n` +
          `the check cannot read is one it never reports on — look for an unbalanced paren\n` +
          `in a template literal above the declaration.`,
      });
      continue;
    }

    const surface = propsFromType(source, component.name);
    const count = surface === null
      ? propsFromDestructure(component.signature.params)
      : surface.names.size;
    if (count === null || count < threshold) continue;

    findings.push({
      severity: "warning",
      file,
      line: component.line,
      message:
        (surface?.complete === false
          ? `${component.name} has at least ${count} props (threshold: ${threshold}).\n` +
            `${floorReason(surface)}\n`
          : `${component.name} has ${count} props (threshold: ${threshold}).\n`) +
        `Decompose into smaller components, group props that always travel together\n` +
        `into one object, or lift shared data into context. If the wide surface is\n` +
        `deliberate — a design-system primitive, or a wrapper forwarding to a third\n` +
        `party — raise the threshold in the project's architecture config.`,
    });
  }

  return findings;
}

function floorReason(surface: PropSurface): string {
  if (surface.unresolved.length === 0) {
    return (
      `That is a floor: part of its Props type is not an object body this check can\n` +
      `enumerate, so the members it contributes are not in the count.`
    );
  }

  const bases = surface.unresolved.join(", ");
  return (
    `That is a floor: prop-count could not read ${bases} out of this file, and it\n` +
    `resolves a base type by name within one file, so the real surface is wider.`
  );
}

/**
 * Property signatures in the component's `type <Name>Props = …` or
 * `interface <Name>Props …`, INCLUDING the members of any base type the
 * declaration intersects or extends, when that base is declared in the same
 * file. Returns null when there is no such declaration, or when nothing at all
 * could be read out of it — in both cases the destructure fallback gets its turn.
 *
 * Anything but `{` is allowed between the name and the body, because
 * `interface OptionListProps<T> {` is the ordinary generic spelling and a
 * pattern requiring `{` or `=` adjacent to the name does not see it — which
 * silently demotes every generic component to the destructure fallback.
 *
 * Names are collected as a SET. `Model & { tone?: Tone }` re-declaring a member
 * of `Model` is one prop in TypeScript and must be one prop here; summing the
 * two sides carries a seven-prop component over an eight-prop threshold, which
 * is the over-count this check must never commit.
 */
function propsFromType(source: string, component: string): PropSurface | null {
  const surface = readPropSurface(source, `${component}Props`, new Set());
  if (surface === null) return null;
  // A Props type nothing could be read out of — `type XProps = Pick<ViewProps, …>`,
  // whose members live in a file this check never opens — is no better than no
  // Props type at all, so it does not get to suppress the destructure fallback.
  if (surface.names.size === 0 && !surface.complete) return null;
  return surface;
}

/**
 * The members `name` declares, following intersection terms and heritage
 * entries into the types they name.
 *
 * A name that resolves to nothing in this file contributes NOTHING and marks
 * the surface incomplete; see the header for why that is the choice.
 */
function readPropSurface(
  source: string,
  name: string,
  visiting: Set<string>,
): PropSurface | null {
  const surface: PropSurface = { names: new Set(), complete: true, unresolved: [] };
  // A type is its own ancestor only in code that does not compile, but a check
  // that loops forever on it is worse than one that under-counts it.
  if (visiting.has(name)) {
    surface.complete = false;
    return surface;
  }

  const declaration = new RegExp(`\\b(type|interface)\\s+${name}\\b`).exec(source);
  if (declaration === null) return null;

  const keyword = declaration[1];
  let at = skipTypeArguments(source, declaration.index + declaration[0].length);
  const nested = new Set(visiting).add(name);

  if (keyword === "interface") {
    at = skipSpace(source, at);
    if (source.startsWith("extends", at)) {
      const body = indexOfHeritageEnd(source, at + "extends".length);
      for (const entry of splitTopLevel(source.slice(at + "extends".length, body), ",")) {
        absorbReference(source, entry, surface, nested);
      }
      at = body;
    }
    absorbObjectBody(source, at, surface);
    return surface;
  }

  at = skipSpace(source, at);
  if (source[at] !== "=") {
    // A declaration with no `=` after the name is not a type alias this check is
    // reading — an `import type X from …` caught by the same pattern, say.
    surface.complete = false;
    return surface;
  }
  at += 1;

  // The right-hand side, term by term. Terms are separated by `&`, and each is
  // either an object body or a reference to a named type. Walking terms rather
  // than hunting for the alias's terminator is what makes `A & B & { … }` and
  // a bare `{ … }` the same code path, and it stops on its own at the first
  // thing that is not another term.
  for (;;) {
    at = skipSpace(source, at);
    if (source[at] === "{") {
      const close = absorbObjectBody(source, at, surface);
      if (close === -1) return surface;
      at = close + 1;
    } else {
      const reference = TYPE_REFERENCE.exec(source.slice(at));
      if (reference === null) {
        surface.complete = false;
        return surface;
      }
      const after = skipTypeArguments(source, at + reference[0].length);
      if (NOT_A_PLAIN_REFERENCE.includes(source[skipSpace(source, after)] ?? "")) {
        surface.complete = false;
        return surface;
      }
      absorbReference(source, reference[0], surface, nested);
      at = after;
    }

    at = skipSpace(source, at);
    if (source[at] !== "&") {
      // `|` is the one terminator worth distinguishing: a union of prop shapes
      // has members this walk never reaches, and calling that complete would be
      // the silent under-count all over again.
      if (source[at] === "|") surface.complete = false;
      return surface;
    }
    at += 1;
  }
}

/** Merge the members of the type `entry` names into `surface`. */
function absorbReference(
  source: string,
  entry: string,
  surface: PropSurface,
  visiting: Set<string>,
): void {
  const name = TYPE_REFERENCE.exec(entry.trim())?.[0];
  if (name === undefined) {
    surface.complete = false;
    return;
  }

  const base = readPropSurface(source, name, visiting);
  if (base === null) {
    surface.complete = false;
    surface.unresolved.push(name);
    return;
  }

  for (const member of base.names) surface.names.add(member);
  if (base.complete) return;

  surface.complete = false;
  // A base that resolved to a declaration yielding nothing — `type Behaviour =
  // Pick<ViewProps, …>` — is named by ITS OWN name, not by the utility type
  // inside it. `Pick` is not the thing the reader has to go and look at.
  surface.unresolved.push(...(base.names.size === 0 ? [name] : base.unresolved));
}

/**
 * Merge the top-level members of the object body opening at `open` into
 * `surface`, and answer where it closes.
 */
function absorbObjectBody(source: string, open: number, surface: PropSurface): number {
  const close = matchingBrace(source, open);
  if (close === -1) {
    surface.complete = false;
    return -1;
  }

  // Members separate on newlines, `;`, or `,`, and one line can hold several.
  // Splitting at top level only means a nested object literal's own members stay
  // with their parent instead of each counting as a prop.
  for (const member of splitTopLevel(source.slice(open + 1, close), ";,\n")) {
    const name = PROPS_MEMBER.exec(member.trim())?.[1];
    if (name !== undefined && name !== "children") surface.names.add(name);
  }
  return close;
}

function skipSpace(source: string, at: number): number {
  let i = at;
  while (i < source.length && /\s/.test(source[i] ?? "")) i++;
  return i;
}

/**
 * Past a type-parameter or type-argument list, if one starts here. The `=>` of
 * an arrow inside it is not a closing bracket — `<T extends () => void>` closes
 * one level, not two.
 */
function skipTypeArguments(source: string, at: number): number {
  let i = skipSpace(source, at);
  if (source[i] !== "<") return at;

  let depth = 0;
  let previous = "";
  for (; i < source.length; i++) {
    const ch = source[i] ?? "";
    if ("<([{".includes(ch)) depth++;
    else if (")]}".includes(ch)) depth--;
    else if (ch === ">" && previous !== "=" && --depth === 0) return i + 1;
    previous = ch;
  }
  return at;
}

/**
 * Where an interface's heritage clause ends and its body begins: the first `{`
 * at depth zero. A base carrying an object literal as a type argument —
 * `extends Row<{ id: string }>` — puts a `{` inside the clause, and stopping at
 * it swallows the real body.
 */
function indexOfHeritageEnd(source: string, at: number): number {
  let depth = 0;
  let previous = "";
  for (let i = at; i < source.length; i++) {
    const ch = source[i] ?? "";
    if (ch === "{" && depth === 0) return i;
    if ("<([{".includes(ch)) depth++;
    else if (")]}".includes(ch)) depth--;
    else if (ch === ">" && previous !== "=") depth--;
    previous = ch;
  }
  return source.length;
}

/**
 * Fallback: the identifiers in the parameter list's `{ … }` destructuring pattern.
 *
 * The counted region ends at the destructure's OWN closing brace. A component
 * annotated with an inline type literal — `({ a, b }: { a: string; b: string })`,
 * which is how most of them are written — puts a second brace pair immediately
 * after the first, and reading to the last brace in the signature counts every
 * name a second time. That doubling carries a seven-prop component past an
 * eight-prop threshold, and over-matching is the defect that teaches people to
 * scroll past a check.
 */
function propsFromDestructure(params: string): number | null {
  const open = params.indexOf("{");
  if (open === -1) return null;
  const close = matchingBrace(params, open);
  if (close === -1) return null;

  let count = 0;
  for (const entry of splitTopLevel(params.slice(open + 1, close), ",")) {
    // `...rest` is explicit forwarding and `children` is a structural
    // convention; neither is a data dependency the component chose to accept.
    const name = entry.trim().split(/[:=]/)[0]?.trim() ?? "";
    if (name === "" || name.startsWith("...") || name === "children") continue;
    count++;
  }
  return count;
}
