// ─── Shared substrate for the structural tier ──────────────────
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
import {
  type DeclaredTree,
  type ValidatedTrees,
  DECLARED_TREES,
  isArchitectureExemptProjectPath,
  isArchitectureExemptSourcePath,
  isUnauthoredSourcePath,
} from "../policy/declared-trees.ts";
import { SOURCE_FILE_GLOB, type TreeVocabulary } from "../policy/layout.ts";
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
 * What a TREE-SCOPED check is handed: one declared tree, and the derived things
 * expensive enough that every consumer must share one copy.
 *
 * One context per declared tree, and the check runs once against each. That is
 * what makes a monorepo's second source root a first-class subject rather than
 * something the first root's graph happens to reach. A design with ONE graph
 * root and a list of other directories walked by name gives every root past the
 * first its file-level checks and no graph at all — silently, because the
 * file-level checks still report and the run still looks complete.
 */
export type TreeContext = {
  config: ArchitectureConfig;
  tree: DeclaredTree;
  /** `tree.vocabulary`, which every check reads and none of them may fork. */
  vocabulary: TreeVocabulary;
  /** Absolute path of this tree's source root. */
  sourceRoot: string;
  /**
   * Every import edge inside THIS tree, resolved and classified. Built on first
   * call and shared from then on, so a project adopting only `health/file-size`
   * never pays for a graph nothing reads.
   *
   * Per tree, and an edge LEAVING the tree is not in it: a specifier resolving
   * outside this source root is not a boundary question this tier can answer,
   * exactly as a bare package specifier is not. Cross-tree coupling is real and
   * nothing here reports it — see the negative space in the tier's overview.
   */
  importGraph(): ImportEdge[];
  /**
   * Names of the immediate subdirectories of a source-root-relative directory,
   * whether or not they hold source this tier walks.
   *
   * This is "which directories are there", and `occupiedDirs` below is that
   * answer filtered. Both exist because checks genuinely want different ones:
   * `api/feature-visibility` audits a per-directory grant file, so a leftover
   * directory holding nothing but a stale `visibility.json` is exactly its
   * subject, while `graph/feature-deps` needs occupancy or an empty directory
   * manufactures a feature. A check reaching for whichever is nearer, rather
   * than the one that matches its question, is how the two arms of one rule end
   * up disagreeing about what a feature is.
   *
   * A symlink to a directory is NOT one, and deliberately: `collectTreeFiles`
   * runs `Bun.Glob.scanSync`, which does not traverse symlinks, so a symlinked
   * directory could never satisfy the occupancy filter anyway and listing it
   * here would only make the two disagree. A check that has to treat an aliased
   * directory and its target as one boundary resolves the name itself — see
   * `featureCanonicaliser` in `api/feature-visibility.ts`, which is where that
   * belongs, because identity is the consuming rule's question and not the
   * walker's.
   */
  subdirs(sourceRelativeDir: string): string[];
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
 * What a PROJECT-SCOPED check is handed: the config, and nothing about any tree.
 *
 * Two checks are in this scope and the list is closed by argument, not by
 * accident. `health/file-size` and `health/doc-budgets` both ask a question about
 * artefacts a human maintains — how long is this file, how long is this document
 * — and neither reads a position in an architecture to answer it. Running them
 * per tree would report a file in two trees twice and miss every file in none.
 *
 * NEGATIVE SPACE: every other check in this tier is tree-scoped, so nothing here
 * reports on a cross-tree edge or on a file outside every declared tree.
 */
export type ProjectContext = {
  config: ArchitectureConfig;
};

/**
 * A check, its catalog rule id, and which scope it runs in. The id is declared
 * here rather than derived from the filename so the fixture harness can prove the
 * registry, the file, and the doc all name the same rule — a check reporting
 * under a label no expectation matches reads as a renamed check rather than a
 * mistake.
 *
 * A discriminated union rather than an optional context field: the scope decides
 * what the runner hands the check, and a check that could receive either would
 * have to guard at runtime for a combination the registry can never produce.
 */
export type StructuralCheck =
  | { id: string; scope: "tree"; run(context: TreeContext): Finding[] }
  | { id: string; scope: "project"; run(context: ProjectContext): Finding[] };

/** One context per declared tree, in declaration order. */
export function createTreeContexts(
  config: ArchitectureConfig,
  trees: ValidatedTrees = DECLARED_TREES,
): TreeContext[] {
  return trees.map((tree) => createTreeContext(config, tree));
}

export function createTreeContext(config: ArchitectureConfig, tree: DeclaredTree): TreeContext {
  let graph: ImportEdge[] | undefined;
  const subdirectories = new Map<string, string[]>();
  const occupied = new Map<string, string[]>();

  const context: TreeContext = {
    config,
    tree,
    vocabulary: tree.vocabulary,
    sourceRoot: resolve(config.projectRoot, tree.root),

    importGraph() {
      graph ??= buildImportGraph(context);
      return graph;
    },

    subdirs(sourceRelativeDir) {
      const memo = subdirectories.get(sourceRelativeDir);
      if (memo !== undefined) return memo;

      const absolute = resolve(context.sourceRoot, sourceRelativeDir);
      const names = existsSync(absolute)
        ? readdirSync(absolute, { withFileTypes: true })
            .filter((entry) => entry.isDirectory())
            .map((entry) => entry.name)
            .sort()
        : [];

      subdirectories.set(sourceRelativeDir, names);
      return names;
    },

    occupiedDirs(sourceRelativeDir) {
      const memo = occupied.get(sourceRelativeDir);
      if (memo !== undefined) return memo;

      const names = context
        .subdirs(sourceRelativeDir)
        .filter(
          (name) =>
            collectTreeFiles(context, SOURCE_FILE_GLOB, { under: `${sourceRelativeDir}/${name}` })
              .length > 0,
        );

      occupied.set(sourceRelativeDir, names);
      return names;
    },
  };

  return context;
}

/** Project-relative path, for findings a human has to act on. */
export function toProjectPath(config: ArchitectureConfig, absolute: string): string {
  const rel = relative(config.projectRoot, absolute);
  return rel.startsWith("..") ? absolute : rel;
}

/** Path from the tree's source root, which is what this tree's positions are relative to. */
export function toSourcePath(context: TreeContext, absolute: string): string {
  return relative(context.sourceRoot, absolute);
}

/**
 * Absolute paths matching `pattern` inside one declared tree, minus the files no
 * rule in the catalog governs.
 *
 * `under` narrows to a source-root-relative directory, and may itself contain
 * glob segments (`features/*` /ui), because "where components live" is a set that
 * grows and listing it by hand goes stale in silence.
 *
 * The exemptions come from `isArchitectureExemptSourcePath`, which BOTH tiers read.
 * Do not add a second test here: a file one tier governs and the other does not
 * is one edge with two answers, and the tier that skips it reports clean.
 *
 * A tree whose root does not exist is not an error — a declared tree that is not
 * checked out simply has nothing to say. That tolerance is also why an
 * unexercised tree is indistinguishable from a working one, which is what the
 * fixture tree's second tree exists to catch.
 */
export function collectTreeFiles(
  context: TreeContext,
  pattern: string,
  options: { under?: string; includeTests?: boolean } = {},
): string[] {
  const under = options.under ?? "";
  const glob = under === "" ? pattern : `${under}/${pattern}`;
  const found: string[] = [];
  for (const absolute of new Bun.Glob(glob).scanSync({ cwd: context.sourceRoot, absolute: true })) {
    // `includeTests` is for the one check whose SUBJECT is an exempt file:
    // `naming/test-file-mirror` audits the names of tests, which every other
    // check skips. It waives THAT exemption and no other — a single "include
    // everything exempt" switch handed the same check the generated, ambient and
    // script exemptions too, and a generated `gen/orphan.test.ts` then drew a
    // finding naming a rename nobody can perform.
    const sourcePath = toSourcePath(context, absolute);
    const exempt =
      options.includeTests === true
        ? isUnauthoredSourcePath(context.vocabulary, sourcePath)
        : isArchitectureExemptSourcePath(context.vocabulary, sourcePath);
    if (!exempt) found.push(absolute);
  }
  return found.sort();
}

/**
 * Absolute paths matching `pattern` under a PROJECT-relative root, for the two
 * checks that are not scoped to a tree.
 *
 * Exemptions are measured from the project root here rather than from a source
 * root, which is what `isArchitectureExemptProjectPath` exists for: `test/` at
 * the top of the repo is the cross-cutting suite in this frame exactly as
 * `test/` at the top of a tree is in the other, and every declared tree's
 * generated directories are named from their own roots.
 */
export function collectProjectFiles(
  config: ArchitectureConfig,
  root: string,
  pattern: string,
): string[] {
  const glob = root === "" ? pattern : `${root}/${pattern}`;
  const found: string[] = [];
  for (const absolute of new Bun.Glob(glob).scanSync({ cwd: config.projectRoot, absolute: true })) {
    if (!isArchitectureExemptProjectPath(toProjectPath(config, absolute))) found.push(absolute);
  }
  return found.sort();
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

/** Index of the `}` closing the `{` at `open`, or -1 if it is never closed. */
export function matchingBrace(code: string, open: number): number {
  let depth = 0;
  for (let i = open; i < code.length; i++) {
    if (code[i] === "{") depth++;
    else if (code[i] === "}" && --depth === 0) return i;
  }
  return -1;
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
