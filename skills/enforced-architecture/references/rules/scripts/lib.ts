// ─── Shared substrate for the structural-script tier ──────────────────
//
// Four things put a check in this tier rather than in `rules/<tag>/*.ts` as an
// oxlint rule:
//
//   1. counting across a file set   — file size, hooks per component, props
//   2. resolution across the tree   — where an import LANDS, not how it is spelled
//   3. a surface the linter cannot see — `.css`, `visibility.json`
//   4. reading the project's own source of truth — the token scale
//
// Everything here is what more than one such check needs. A check reaching for
// its own file walker or its own exclusion list is how two checks end up
// governing different sets of files while claiming the same scope.
//
// ──────────────────────────────────────────────────────────────────────

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { relative, resolve } from "node:path";
import type { ArchitectureConfig } from "./config.ts";
import { buildImportGraph, type ImportEdge } from "./import-graph.ts";

export type Severity = "error" | "warning";

/**
 * One diagnostic. `file` is required and project-relative: it is what lets the
 * orchestrator suppress warnings for files a commit never opened, and what the
 * fixture harness compares. `line` is 1-based and optional because the import
 * graph genuinely cannot always place an edge — see `specifierLines`.
 */
export type Finding = {
  severity: Severity;
  file: string;
  line?: number;
  message: string;
};

/**
 * What a check is handed. Deliberately small: the config, plus the two derived
 * things expensive enough that every consumer must share one copy.
 */
export type CheckContext = {
  config: ArchitectureConfig;
  /**
   * Every import edge under the source root, resolved and classified. Built on
   * first call and shared from then on, so a project adopting only `health/
   * file-size` never pays for a graph nothing reads.
   */
  importGraph(): ImportEdge[];
  /**
   * Names of the immediate subdirectories of a source-root-relative directory
   * that hold at least one source file.
   *
   * The occupancy test is not incidental. An empty leftover directory otherwise
   * manufactures a feature, and a check reports a passing result over a set it
   * never really had — `graph/feature-deps` in particular needs two features to
   * have a subject at all.
   */
  occupiedDirs(sourceRelativeDir: string): string[];
};

/**
 * A check, and its catalog rule id. The id is declared here rather than derived
 * from the filename so the fixture harness can prove the registry, the file, and
 * the doc all name the same rule — a check reporting under a label no
 * expectation matches reads as a renamed check rather than a mistake.
 */
export type StructuralCheck = {
  id: string;
  run(context: CheckContext): Finding[];
};

export function createCheckContext(config: ArchitectureConfig): CheckContext {
  let graph: ImportEdge[] | undefined;
  const occupied = new Map<string, string[]>();

  return {
    config,

    importGraph() {
      graph ??= buildImportGraph(config);
      return graph;
    },

    occupiedDirs(sourceRelativeDir) {
      const memo = occupied.get(sourceRelativeDir);
      if (memo !== undefined) return memo;

      const absolute = resolve(sourceRoot(config), sourceRelativeDir);
      const names = existsSync(absolute)
        ? readdirSync(absolute, { withFileTypes: true })
            .filter((entry) => entry.isDirectory())
            .map((entry) => entry.name)
            .filter(
              (name) =>
                collectFiles(config, `${sourceRelativeDir}/${name}`, "**/*.{ts,tsx}", {
                  fromSourceRoot: true,
                }).length > 0,
            )
            .sort()
        : [];

      occupied.set(sourceRelativeDir, names);
      return names;
    },
  };
}

/** Absolute path of the import graph's source root — the first configured root. */
export function sourceRoot(config: ArchitectureConfig): string {
  const first = config.source.roots[0];
  if (first === undefined) {
    throw new Error("source.roots is empty: there is no tree to check.");
  }
  return resolve(config.projectRoot, first);
}

export function isExcluded(config: ArchitectureConfig, path: string): boolean {
  return config.source.exclude.some((pattern) => pattern.test(path));
}

/** Project-relative path, for findings a human has to act on. */
export function toProjectPath(config: ArchitectureConfig, absolute: string): string {
  const rel = relative(config.projectRoot, absolute);
  return rel.startsWith("..") ? absolute : rel;
}

/** Path from the import graph's source root, which is what boundaries are relative to. */
export function toSourcePath(config: ArchitectureConfig, absolute: string): string {
  return relative(sourceRoot(config), absolute);
}

/**
 * Absolute paths matching `pattern` under `root`, minus the global exclusions.
 *
 * `root` is project-relative by default, or source-root-relative with
 * `fromSourceRoot`. It may itself contain glob segments (`features/*` /ui),
 * because "where components live" is a set that grows and listing it by hand
 * goes stale in silence.
 *
 * A configured root that does not exist is not an error — a check whose root is
 * absent simply has nothing to say. That tolerance is also why an unexercised
 * root is indistinguishable from a working one, which is what the fixture tree's
 * second root exists to catch.
 */
export function collectFiles(
  config: ArchitectureConfig,
  root: string,
  pattern: string,
  options: { fromSourceRoot?: boolean; includeExcluded?: boolean } = {},
): string[] {
  const base = options.fromSourceRoot === true ? sourceRoot(config) : config.projectRoot;
  const glob = root === "" ? pattern : `${root}/${pattern}`;
  const found: string[] = [];
  for (const absolute of new Bun.Glob(glob).scanSync({ cwd: base, absolute: true })) {
    // `includeExcluded` is for the one check whose SUBJECT is an excluded file:
    // `naming/test-file-mirror` audits the names of tests, which every other
    // check skips. Nothing else should reach for it.
    if (options.includeExcluded === true || !isExcluded(config, absolute)) found.push(absolute);
  }
  return found.sort();
}

/** `collectFiles` over every configured source root, deduplicated. */
export function collectSourceFiles(config: ArchitectureConfig, pattern: string): string[] {
  const seen = new Set<string>();
  for (const root of config.source.roots) {
    for (const path of collectFiles(config, root, pattern)) seen.add(path);
  }
  return [...seen].sort();
}

export function readFile(absolute: string): string {
  return readFileSync(absolute, "utf8");
}

/**
 * Comments replaced by spaces, newlines kept.
 *
 * Blanked rather than stripped, always. Every reported line number and every
 * offset-to-line conversion downstream depends on the blanked copy having the
 * same shape as the file on disk, and a check that strips instead reports lines
 * that drift further from the truth the more comments a file carries.
 */
export function blankComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (match) =>
    match.replace(/[^\n]/g, " "),
  );
}

/**
 * Line comments and string/template literals emptied, for line-oriented matching
 * where a hook name in a comment or a `"useFoo"` in a string would false-positive.
 *
 * A heuristic, not a tokenizer, and deliberately conservative: it works per line,
 * so a template literal spanning lines is not tracked. Use `blankComments` when
 * offsets have to survive.
 */
export function stripCommentsAndStrings(line: string): string {
  return line
    .replace(/\/\/.*$/, "")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/`(?:[^`\\]|\\.)*`/g, "``");
}

/**
 * Split on any of `separators`, but only at bracket depth zero — commas and
 * semicolons inside `{}`, `[]`, `()`, or `<>` stay with their member. Used to
 * count type members and destructured parameters without an AST.
 *
 * The `=>` guard matters more than it looks. An arrow in a member's type
 * (`onDone: (id: string) => void`) ends in a `>` that would otherwise close a
 * bracket never opened, dropping depth below zero for the rest of the input and
 * splitting the remainder in the wrong places.
 */
export function splitTopLevel(input: string, separators: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let token = "";
  let previous = "";
  for (const ch of input) {
    if ("{[(<".includes(ch)) depth++;
    else if ("}])".includes(ch)) depth--;
    else if (ch === ">" && previous !== "=") depth--;
    previous = ch;
    if (depth === 0 && separators.includes(ch)) {
      out.push(token);
      token = "";
    } else token += ch;
  }
  if (token) out.push(token);
  return out;
}

/** Offset of each line start, for converting a match offset to a 1-based line number. */
export function lineStartOffsets(source: string): number[] {
  const starts = [0];
  for (let at = source.indexOf("\n"); at !== -1; at = source.indexOf("\n", at + 1)) {
    starts.push(at + 1);
  }
  return starts;
}

/** The last line starting at or before `offset`. */
export function lineNumberAt(lineStarts: number[], offset: number): number {
  let low = 0;
  let high = lineStarts.length - 1;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if ((lineStarts[mid] ?? 0) <= offset) low = mid;
    else high = mid - 1;
  }
  return low + 1;
}
