// ─── graph/import-graph — the resolved import graph ───────────────────
//
// Not a rule. This is the substrate six rules consume instead of each matching
// import strings on its own: `boundary/cross-boundary-alias`,
// `placement/layer-direction`, `boundary/layer-occupancy`, `graph/feature-deps`,
// `graph/domain-cycles`, and `api/feature-visibility`.
//
// They all ask WHERE AN IMPORT LANDS, and a pattern over the specifier only sees
// HOW IT IS SPELLED. The two come apart the moment a directory nests:
// `../../beta/service` from `features/alpha/ui/` leaves the feature while naming
// no directory a regex can match. The answer is a function of where the
// IMPORTING file sits, so it has to be resolved and compared, never matched.
//
// The failure is worse than a miss. Every other boundary rule matches the
// ALIASED form of a path, so a cross-boundary import written relatively names
// the same module with a string none of those rules see — a working bypass for
// the whole `boundary/` tag, written as ordinary code.
//
// See `graph/import-graph.md` for the intent, the negative space, and the
// type-only policy this file implements.
//
// ──────────────────────────────────────────────────────────────────────

import { readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import type { ArchitectureConfig } from "./config.ts";
import {
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
  /** 1-based. Undefined is a real case — see `specifierLines`. */
  line: number | undefined;
  /** As written, for the message only. Never match on this. */
  specifier: string;
  relative: boolean;
  /**
   * The RESOLVED path from the source root. Classification alone collapses
   * distinctions a consumer still needs — `layer-occupancy` has to tell
   * `infrastructure/db/schema` from `infrastructure/db/client`, and both
   * classify as `infrastructure`. A consumer that reaches for the raw specifier
   * instead is back to matching spellings, which is the bypass this tier closes.
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
    const current = new Map<string, ScannedImport[]>();
    for (const entry of group) {
      const key = `${entry.kind}\0${entry.path}`;
      current.set(key, [...(current.get(key) ?? []), entry]);
    }
    for (const [key, entries] of current) {
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
  const injected = new Set([
    jsxImportSource,
    `${jsxImportSource}/jsx-runtime`,
    `${jsxImportSource}/jsx-dev-runtime`,
  ]);

  const budget = new Map<string, number>();
  for (const path of injected) {
    budget.set(path, countLiteralRequires(source, path));
  }

  return entries.filter((entry) => {
    if (entry.kind !== "require-call" || !injected.has(entry.path)) return true;
    const left = budget.get(entry.path) ?? 0;
    if (left === 0) return false;
    budget.set(entry.path, left - 1);
    return true;
  });
}

function countLiteralRequires(source: string, specifier: string): number {
  let count = 0;
  for (const quote of ['"', "'"]) {
    const needle = `require(${quote}${specifier}${quote}`;
    for (let at = source.indexOf(needle); at !== -1; at = source.indexOf(needle, at + 1)) {
      count += 1;
    }
  }
  return count;
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
 *
 * What a caller does with the result is its own business. The graph counts
 * occurrences and reveals erased type-only edges; barrel-purity collapses the
 * result to a set of specifiers, because it asks whether a package is reachable
 * and never how many times.
 */
export function scanDeclaredImports(options: {
  /** Selects the reader: `.tsx`/`.jsx` need the JSX loader, and the two cannot be collapsed. */
  absolute: string;
  source: string;
  jsxImportSource: string;
  /** How the file is named if the read throws. A bare `input.tsx:11` names a file nobody has. */
  reportAs: string;
}): ScannedImport[] {
  const { absolute, source, jsxImportSource, reportAs } = options;
  const reader = readerFor(absolute);
  try {
    return withoutInjectedJsxRuntime(
      unionByKindAndPath(reader.scanImports(source), reader.scan(source).imports),
      source,
      jsxImportSource,
    );
  } catch (error) {
    throw new Error(`could not read ${reportAs}: ${(error as Error).message}`);
  }
}

/**
 * Reveals the imports the reader erases. A type-only import emits no runtime
 * code, so both scans drop it — but a type crossing a boundary is still
 * coupling, so it has to come back.
 *
 * This is policy 2 from the doc: best-effort augmentation, unioned with the
 * unmodified scan so an unrevealed shape costs a type-only marking and never a
 * runtime edge. Known-missing spellings, all valid and none of them revealed: a
 * comment between the `import` and `type` keywords, a brace inside a clause
 * comment (which ends the clause match early), and an `import(…)` in a type
 * position such as `type C = import("./c").C`. `graph/import-graph.md` lists
 * them in full, and says what to do instead when complete type coupling matters.
 *
 * The narrowness of each replacement is load-bearing, because the reader THROWS
 * on code it cannot parse and one unparseable file aborts the whole graph:
 *
 *   - `export type` usually opens a type ALIAS, so only the re-export forms
 *     (`export type {`, `export type *`) may be touched. Stripping it from
 *     `export type Foo = …` yields `export Foo = …`.
 *   - inline `{ type A }` is stripped only inside a span already matched as an
 *     import clause ending in `from "…"`. Loose, it turns a local
 *     `function f() { type A<T> = T }` into a parse error.
 */
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
 * would otherwise abort the whole
 * graph. Do not fall back to line 1 either: a wrong line on a blocking check
 * sends someone to the wrong place.
 */
function specifierLines(
  source: string,
  lineStarts: number[],
  specifier: string,
  count: number,
): Array<number | undefined> {
  const offsets: number[] = [];
  for (const quote of ['"', "'"]) {
    // indexOf, not a regex — a specifier can hold regex metacharacters.
    const needle = `${quote}${specifier}${quote}`;
    for (let at = source.indexOf(needle); at !== -1; at = source.indexOf(needle, at + 1)) {
      offsets.push(at);
    }
  }
  offsets.sort((a, b) => a - b);

  return Array.from({ length: count }, (_, index) => {
    const offset = offsets[index];
    return offset === undefined ? undefined : lineNumberAt(lineStarts, offset);
  });
}

/** `(line N)`, or nothing when the graph could not place the import. */
export function describeEdgeLine(edge: { line: number | undefined }): string {
  return edge.line === undefined ? "" : ` (line ${edge.line})`;
}

export function classify(config: ArchitectureConfig, pathFromSourceRoot: string): Classification {
  const { subdividedDirs, featuresDirName, domainsDirName, layerOrder, roots } = config.source;
  const segments = pathFromSourceRoot.split("/");
  const [top, second, third] = segments;

  // No directory component means a file sitting directly in the source root — an
  // entrypoint, an env module, a generated route tree. They share ONE boundary.
  // Naming each such file its own boundary makes `./router` from `client.tsx`
  // read as a crossing, which is the first false positive this produces if the
  // general case is left to handle them.
  if (top === undefined || second === undefined) {
    const rootName = (roots[0] ?? "src").split("/").at(-1) ?? "src";
    return { boundary: rootName, feature: undefined, domain: undefined, layer: undefined };
  }

  if (!subdividedDirs.includes(top)) {
    return { boundary: top, feature: undefined, domain: undefined, layer: undefined };
  }

  const layer = third !== undefined && layerOrder.includes(third) ? third : undefined;
  return {
    boundary: `${top}/${second}`,
    feature: top === featuresDirName ? second : undefined,
    domain: top === domainsDirName ? second : undefined,
    layer,
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
  const assets = config.source.assetExtensions.join("|");
  if (new RegExp(String.raw`\.(?:${assets})(?:\?.*)?$`).test(specifier)) return undefined;

  const root = sourceRoot(config);
  const { aliasPrefix } = config.source;
  const absolute = specifier.startsWith(aliasPrefix)
    ? resolve(root, specifier.slice(aliasPrefix.length))
    : specifier.startsWith(".")
      ? resolve(dirname(fromFile), specifier)
      : undefined;

  if (absolute === undefined) return undefined;

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
    const raw = blankShebang(readFileSync(absolute, "utf8"));

    const scan = (source: string): ScannedImport[] =>
      scanDeclaredImports({
        absolute,
        source,
        jsxImportSource: config.source.jsxImportSource,
        reportAs: toProjectPath(config, absolute),
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

    // Comments blanked so a commented-out import cannot claim the line of the
    // real one below it. Blanked, not stripped, so offsets stay aligned. Only
    // for the lookup — the reader gets raw source; it lexes comments correctly.
    const source = raw.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (match) =>
      match.replace(/[^\n]/g, " "),
    );
    const lineStarts = lineStartOffsets(source);
    const from = classify(config, relative(root, absolute));

    const fileEdges: ImportEdge[] = [];
    for (const specifier of new Set([...revealed.keys(), ...runtime.keys()])) {
      const target = resolveWithinSource(config, absolute, specifier);
      if (target === undefined) continue;

      const runtimeCount = runtime.get(specifier) ?? 0;
      const count = Math.max(runtimeCount, revealed.get(specifier) ?? 0);
      for (const line of specifierLines(source, lineStarts, specifier, count)) {
        fileEdges.push({
          file: toProjectPath(config, absolute),
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
