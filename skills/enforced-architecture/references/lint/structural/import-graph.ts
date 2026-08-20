// ─── graph/import-graph — the resolved import graph ───────────────────
//
// Makes sure: Every rule sees where an import lands, and not how a person
// writes it. The relative path "../../beta/service" and the alias
// "@/features/beta" give the same answer. A person cannot get past a boundary
// rule when they write a crossing as a relative path.
//
// Not a rule. This is the substrate every graph-reading check consumes, and no
// check reads imports itself. Whether an import leaves its boundary depends on
// the depth of the file that holds it, never on the shape of the specifier, so
// each edge is resolved and compared as a path. Do not match a pattern against
// a specifier.
//
// api/barrel-purity is the one rule that reads imports and does not take the
// graph. Resolution discards bare package names, and those names are that
// rule's subject. It uses scanDeclaredImports instead.
//
// ──────────────────────────────────────────────────────────────────────

import { readFileSync } from "node:fs";
import { basename, dirname, relative, resolve } from "node:path";
import type { ArchitectureConfig } from "./config.ts";
import {
  blankComments,
  collectFiles,
  lineNumberAt,
  lineStartOffsets,
  sourceRoot,
  toProjectPath,
} from "./check-substrate.ts";

/**
 * Where one end of an edge sits. `boundary` is always known; `feature`,
 * `domain`, and `layer` are the finer questions, undefined when the end is not
 * in one.
 */
export type Classification = {
  /** Top-level directory, or `<subdivided>/<name>` under a subdivided one. */
  boundary: string;
  feature: string | undefined;
  domain: string | undefined;
  /** First segment inside a feature, when it names a configured layer. */
  layer: string | undefined;
};

export type ImportEdge = {
  /** Importing file, project-relative. */
  file: string;
  /**
   * The importing file's path FROM THE SOURCE ROOT, the same frame `target`
   * is in. Both ends of an edge have to be in one frame to be compared, and
   * the graph already computes this to classify `from` — consumers that
   * re-derived it from `file` each carried their own root-stripper, and the
   * two disagreed on a path outside the root.
   */
  sourcePath: string;
  /** 1-based. Undefined is a real case — see `specifierLines`. */
  line: number | undefined;
  /** As written, for the message only. Never match on this. */
  specifier: string;
  /** Written as a path rather than through the alias. This is where the two tiers divide. */
  relative: boolean;
  /**
   * The RESOLVED path from the source root. Classification alone collapses
   * distinctions a consumer still needs — `layer-occupancy` has to tell
   * `infrastructure/db/schema` from `infrastructure/db/client`, and both
   * classify as `infrastructure`.
   */
  target: string;
  /** True only when the file has NO runtime import of the same specifier. */
  typeOnly: boolean;
  from: Classification;
  to: Classification;
};

/**
 * One reader PER SYNTAX FAMILY, not per file. Under the `tsx` loader a generic
 * arrow in a plain `.ts` file — `const stamp = <T>(rows: T[]) => …` — reads as an
 * unclosed JSX tag and the reader THROWS. Readers hold no per-file state, so
 * they live for the whole run.
 *
 * Built on first use rather than at module load, so this module can be IMPORTED
 * outside Bun. The oxlint tier's harness runs under real Node and reads the
 * script registry to know which ids are not its business; a `new Bun.Transpiler`
 * in module scope makes that import a crash.
 */
let readers: { ts: Bun.Transpiler; tsx: Bun.Transpiler } | undefined;

export type ScannedImport = ReturnType<Bun.Transpiler["scanImports"]>[number];

function readerFor(path: string): Bun.Transpiler {
  readers ??= {
    ts: new Bun.Transpiler({ loader: "ts" }),
    tsx: new Bun.Transpiler({ loader: "tsx" }),
  };
  return path.endsWith(".tsx") || path.endsWith(".jsx") ? readers.tsx : readers.ts;
}

/**
 * Offsets of every `<prefix>"text"` and `<prefix>'text'`, in source order.
 * indexOf rather than a regex, because a specifier can hold regex
 * metacharacters.
 */
function quotedLiteralOffsets(source: string, prefix: string, text: string): number[] {
  const offsets: number[] = [];
  for (const quote of ['"', "'"]) {
    const needle = `${prefix}${quote}${text}${quote}`;
    for (let at = source.indexOf(needle); at !== -1; at = source.indexOf(needle, at + 1)) {
      offsets.push(at);
    }
  }
  return offsets.sort((a, b) => a - b);
}

/**
 * Union of two groups, keyed by `{ kind, path }`, keeping whichever group saw a
 * key more times.
 *
 * Both scans use Bun's parser but expose different edges: `scanImports()`
 * includes literal `require()`, `scan().imports` includes `require.resolve()`.
 * Neither can replace the other, so a check taking only one loses a whole class
 * of edge — silently, since a missing edge reports nothing.
 */
function unionByKindAndPath(...groups: ScannedImport[][]): ScannedImport[] {
  const merged = new Map<string, ScannedImport[]>();
  for (const group of groups) {
    for (const [key, entries] of Map.groupBy(group, (entry) => `${entry.kind}\0${entry.path}`)) {
      if (entries.length > (merged.get(key)?.length ?? 0)) merged.set(key, entries);
    }
  }
  return [...merged.values()].flat();
}

/**
 * Bun's JSX transform injects runtime imports the file never wrote, and
 * `scanImports()` reports them as `require-call` — the same kind as a real
 * `require()`. One `import { useState } from "react"` in a `.tsx` file comes back
 * as three entries: the real import, a `require-call` for
 * `react/jsx-dev-runtime`, and a duplicate `require-call` for `react`.
 *
 * So drop `require-call` entries for the JSX package and its runtime subpaths,
 * but keep as many as the source actually spells with a literal `require(`. A
 * static import string does not justify a `require-call` entry; a real
 * `require("react")` does.
 */
function withoutInjectedJsxRuntime(
  entries: ScannedImport[],
  source: string,
  jsxImportSource: string,
): ScannedImport[] {
  // Keys are the injected paths, values what the source is still owed. One map,
  // so the set of injected paths and their budgets cannot disagree.
  const budget = new Map<string, number>();
  for (const path of [
    jsxImportSource,
    `${jsxImportSource}/jsx-runtime`,
    `${jsxImportSource}/jsx-dev-runtime`,
  ]) {
    budget.set(path, quotedLiteralOffsets(source, "require(", path).length);
  }

  return entries.filter((entry) => {
    if (entry.kind !== "require-call") return true;
    const left = budget.get(entry.path);
    if (left === undefined) return true;
    if (left === 0) return false;
    budget.set(entry.path, left - 1);
    return true;
  });
}

/**
 * Every import entry a file declares: both of Bun's scans, unioned by
 * `{ kind, path }`, with Bun's injected JSX-runtime entries removed. The tier's
 * one extraction, and the only supported way to read a file's imports.
 *
 * Exported because `api/barrel-purity` cannot use the resolved graph below —
 * resolution discards bare package specifiers as "not a boundary question", and
 * bare package names are that rule's entire subject — but it must not re-derive
 * the scan either. The union and the JSX filter are precisely where the silent
 * losses live: take one scan and `require()` or `require.resolve()` edges vanish
 * with no error, skip the filter and every `.tsx` file gains imports it never
 * wrote. Two copies of this drift, and neither copy reports that it has.
 */
export function scanDeclaredImports(options: {
  /**
   * How the file is named if the read throws — a bare `input.tsx:11` names a
   * file nobody has — and, by its extension, which reader parses it.
   */
  path: string;
  source: string;
  jsxImportSource: string;
}): ScannedImport[] {
  const { path, source, jsxImportSource } = options;
  const reader = readerFor(path);
  try {
    return withoutInjectedJsxRuntime(
      unionByKindAndPath(reader.scanImports(source), reader.scan(source).imports),
      source,
      jsxImportSource,
    );
  } catch (error) {
    throw new Error(`could not read ${path}: ${String(error)}`);
  }
}

// ── Type-only imports ─────────────────────────────────────────────────
//
// The reader erases a type-only import, so `buildImportGraph` reads the source a
// second time through `revealTypeImports` and unions the two results. A form
// this pass does not reveal costs a type-only MARK, never a runtime edge.
//
// These forms are correct TypeScript and stay lost:
//
//   import /* why */ type { A } from "./a";  // a comment between the keywords
//   export type /* why */ { B } from "./b";
//   import { type A /* } */ } from "./a";    // a brace in a comment stops the clause
//   type C = import("./c").C;                // an import in a type position
//   type D = typeof import("./d");
//
// Do not make the replacements wider to catch these forms. The reader throws on
// code it cannot parse, and one bad file stops the whole graph — which is also
// why each replacement is as narrow as it is:
//
//   - `export type` usually opens a type ALIAS, so only the re-export forms
//     (`export type {`, `export type *`) may be touched. Stripping it from
//     `export type Foo = …` yields `export Foo = …`.
//   - inline `{ type A }` is stripped only inside a span already matched as an
//     import clause ending in `from "…"`. Loose, it turns a local
//     `function f() { type A<T> = T }` into a parse error.
//
// If a project must have complete type coupling, use the TypeScript compiler
// AST. A rewrite of the source text is the wrong base for an invariant you
// intend to claim.

const IMPORT_CLAUSE = /\b(?:import|export)\s*\{[^{}]*\}\s*from\s*["'][^"']+["']/g;

function revealTypeImports(source: string): string {
  return source
    .replace(/\bimport\s+type\b/g, "import")
    .replace(/\bexport\s+type\s+(?=[{*])/g, "export ")
    .replace(IMPORT_CLAUSE, (clause) => clause.replace(/([{,]\s*)type\s+/g, "$1"));
}

/**
 * A shebang is valid at the top of an executable source file and the reader
 * rejects it outright, taking every edge in the file with it. Blanked rather
 * than stripped so later offsets still map to the right line.
 */
function blankShebang(source: string): string {
  return source.replace(/^#![^\n]*/, (match) => " ".repeat(match.length));
}

function tally(entries: ScannedImport[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const entry of entries) counts.set(entry.path, (counts.get(entry.path) ?? 0) + 1);
  return counts;
}

/**
 * Where each import of `specifier` sits. The reader is the authority on WHICH
 * specifiers exist and HOW MANY times; the text is used only to find WHERE.
 *
 * That inversion is deliberate. Prose quoting the same path can claim a line
 * ahead of the real import, which costs a wrong line number on a finding still
 * reported — never a lost finding.
 *
 * Undefined when the literal is absent, because the reader returns the COOKED
 * path: a specifier written with a unicode escape comes back decoded and matches
 * no literal in the text. Do not throw — nothing catches it, so one such import
 * would otherwise abort the whole graph. Do not fall back to line 1 either: a
 * wrong line on a blocking check sends someone to the wrong place.
 */
function specifierLines(
  source: string,
  lineStarts: number[],
  specifier: string,
  count: number,
): Array<number | undefined> {
  const offsets = quotedLiteralOffsets(source, "", specifier);
  return Array.from({ length: count }, (_, index) => {
    const offset = offsets.at(index);
    return offset === undefined ? undefined : lineNumberAt(lineStarts, offset);
  });
}

/** `(line N)`, or nothing when the graph could not place the import. */
export function describeEdgeLine(edge: { line: number | undefined }): string {
  return edge.line === undefined ? "" : ` (line ${edge.line})`;
}

export function classify(config: ArchitectureConfig, pathFromSourceRoot: string): Classification {
  const { subdividedDirs, featuresDirName, domainsDirName, layerOrder } = config.source;
  const [top, second, third] = pathFromSourceRoot.split("/");

  // No directory component means a file sitting directly in the source root — an
  // entrypoint, an env module, a generated route tree. They share ONE boundary.
  // Naming each such file its own boundary makes `./router` from `client.tsx`
  // read as a crossing, which is the first false positive this produces if the
  // general case is left to handle them.
  if (top === undefined || second === undefined) {
    return {
      boundary: basename(sourceRoot(config)),
      feature: undefined,
      domain: undefined,
      layer: undefined,
    };
  }

  if (!subdividedDirs.includes(top)) {
    return { boundary: top, feature: undefined, domain: undefined, layer: undefined };
  }

  return {
    boundary: `${top}/${second}`,
    feature: top === featuresDirName ? second : undefined,
    domain: top === domainsDirName ? second : undefined,
    layer: third !== undefined && layerOrder.includes(third) ? third : undefined,
  };
}

/**
 * Resolves a specifier against the importing file, returning its path from the
 * source root. Undefined means it is not a boundary question: a bare package
 * name, an asset, or a relative path climbing out of the source root entirely.
 */
function resolveWithinSource(
  config: ArchitectureConfig,
  fromFile: string,
  specifier: string,
): string | undefined {
  const withoutQuery = specifier.replace(/\?.*$/, "");
  if (config.source.assetExtensions.some((ext) => withoutQuery.endsWith(`.${ext}`))) {
    return undefined;
  }

  const { aliasPrefix } = config.source;
  const aliased = specifier.startsWith(aliasPrefix);
  if (!aliased && !specifier.startsWith(".")) return undefined;

  const root = sourceRoot(config);
  const absolute = aliased
    ? resolve(root, specifier.slice(aliasPrefix.length))
    : resolve(dirname(fromFile), specifier);

  const target = relative(root, absolute);
  return target.startsWith("..") ? undefined : target;
}

/**
 * Every resolved import edge under the source root.
 *
 * Callers should reach this through `CheckContext.importGraph()`, which builds
 * it once and shares it. Calling this directly rescans the tree.
 */
export function buildImportGraph(config: ArchitectureConfig): ImportEdge[] {
  const root = sourceRoot(config);
  const edges: ImportEdge[] = [];

  for (const absolute of collectFiles(config, "", "**/*.{ts,tsx,mts,cts}", {
    fromSourceRoot: true,
  })) {
    const file = toProjectPath(config, absolute);
    const raw = blankShebang(readFileSync(absolute, "utf8"));

    const scan = (text: string): ScannedImport[] =>
      scanDeclaredImports({
        path: file,
        source: text,
        jsxImportSource: config.source.jsxImportSource,
      });

    const runtime = tally(scan(raw));
    // Wrapped separately: the reveal pass rewrites source, so its failure must
    // cost the type-only markings and never the runtime graph.
    let revealed: Map<string, number>;
    try {
      revealed = tally(scan(revealTypeImports(raw)));
    } catch {
      revealed = new Map();
    }

    // Blanked so a commented-out import cannot claim the line of the real one
    // below it. Only for the lookup — the reader gets raw source; it lexes
    // comments correctly.
    const source = blankComments(raw);
    const lineStarts = lineStartOffsets(source);
    const sourcePath = relative(root, absolute);
    const from = classify(config, sourcePath);

    const fileEdges: ImportEdge[] = [];
    for (const specifier of new Set([...revealed.keys(), ...runtime.keys()])) {
      const target = resolveWithinSource(config, absolute, specifier);
      if (target === undefined) continue;

      const runtimeCount = runtime.get(specifier) ?? 0;
      const count = Math.max(runtimeCount, revealed.get(specifier) ?? 0);
      for (const line of specifierLines(source, lineStarts, specifier, count)) {
        fileEdges.push({
          file,
          sourcePath,
          line,
          specifier,
          relative: specifier.startsWith("."),
          target,
          // Per specifier, not per file. A file with both spellings of the same
          // specifier reports every occurrence as runtime, which is the loud
          // direction for consumers that skip erased coupling.
          typeOnly: runtimeCount === 0,
          from,
          to: classify(config, target),
        });
      }
    }

    // The reader groups by specifier, so line order has to be restored — every
    // consumer reports findings in the order the graph hands them over. An edge
    // with no locatable line sorts last rather than to the top of the file.
    fileEdges.sort((a, b) => (a.line ?? Infinity) - (b.line ?? Infinity));
    edges.push(...fileEdges);
  }

  return edges;
}
