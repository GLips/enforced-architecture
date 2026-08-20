// ─── policy/declared-trees — which trees this project adopted the catalog for ─
//
// The one list. A declared tree is a source root plus the vocabulary that root
// uses, and BOTH tiers read this file: the oxlint rules resolve the file they
// were handed into a tree before they match anything, and the structural tier's
// `arch.config.ts` binds the same list to a project root.
//
// NEGATIVE SPACE, and it has to be in the setup docs as well as here: a tree you
// did not declare is a tree you did not adopt for. Every rule in this catalog is
// SILENT outside every declared tree — no findings, no warnings, no "unclassified"
// diagnostic — and that silence is not coverage. An undeclared package reads
// exactly like a clean one, so a repo that adds `packages/reporting/` and forgets
// this file has added an unpoliced tree and nothing will say so.
//
// ── Adapt ────────────────────────────────────────────────────────────────────
//
// One entry per tree the catalog governs. A single-app repo declares one:
//
//   export const DECLARED_TREES: DeclaredTree[] = [
//     { root: "src", vocabulary: RECOMMENDED_VOCABULARY },
//   ];
//
// A monorepo declares one per governed source root, and each carries its OWN
// vocabulary — the app may layer features while a package spells its adapters
// differently:
//
//   export const DECLARED_TREES: DeclaredTree[] = [
//     { root: "apps/web/src", vocabulary: RECOMMENDED_VOCABULARY },
//     {
//       root: "packages/core/src",
//       vocabulary: { ...RECOMMENDED_VOCABULARY, infrastructureDir: "db" },
//     },
//   ];
//
// The vocabulary is names and numbers only — see `TreeVocabulary`. What a tree
// cannot declare is which INVARIANTS apply to it: there is no per-tree rule list
// here, and adding one would turn this catalog back into a menu.
//
// Whatever this list says, the shipped `.oxlintrc.json` has to say too: its
// `overrides` entry scopes the `arch/` rules to these roots, and
// `harness/run-rule-fixtures.ts` fails the build when the two disagree.
// Declaration and scoping are one list wearing two hats, exactly as registration
// and enablement are.
//
// ─────────────────────────────────────────────────────────────────────────────

import {
  classifySourcePath,
  RECOMMENDED_VOCABULARY,
  type SourcePlace,
  type TreeVocabulary,
  withoutSourceExtension,
} from "./layout.ts";

export type DeclaredTree = {
  /**
   * The tree's source root, project-relative, with no trailing slash:
   * `src`, `apps/web/src`, `packages/core/src`.
   *
   * The oxlint tier is handed an ABSOLUTE filename and has no project root to
   * measure against, so a file is matched to a tree by finding this path as a
   * run of whole segments — which is why a multi-segment root is worth
   * declaring even when its last segment would be unique. `apps/web/src` and
   * `packages/core/src` are distinguishable; two roots both declared as `src`
   * are not, and the classifier cannot invent the difference.
   */
  root: string;
  vocabulary: TreeVocabulary;
};

/**
 * The trees this project has adopted the catalog for. Edit this list; do not
 * edit a rule.
 */
export const DECLARED_TREES: DeclaredTree[] = [
  { root: "src", vocabulary: RECOMMENDED_VOCABULARY },
];

/**
 * The architecture rules govern application source. Tests and one-off scripts sit outside that
 * contract on purpose: a test may import whatever it needs to exercise a seam, and a script is not
 * part of the shipped module graph.
 *
 * GENERATED and AMBIENT files are exempt for a different reason: nobody wrote them, so a finding
 * against one names no edit anyone can make. A `.d.ts` in particular declares types and emits no
 * runtime edge at all.
 *
 * ONE definition, read by both tiers. It used to be two — a regex trio in the oxlint tier and a
 * `source.exclude` list in the structural config — with a comment in the first instructing the
 * reader to keep the second in step by hand. A file one tier governs and the other does not is one
 * edge with two answers.
 *
 * Every case here is a STRUCTURAL FACT about the file: how it is named, or which directory it sits
 * in. There is no list an adopting project extends, deliberately — an extensible exemption list is
 * a bypass vector, and a rule that cannot be switched off must not ship with a back door that can.
 *
 * `path` is relative to a frame the caller chooses: the tree's source root for the oxlint tier, the
 * project root for the two project-scoped structural checks. Every test but one is on a segment or
 * a suffix and reads the same in either frame; the exception is the cross-cutting `test/` directory,
 * which is only recognised at the FIRST segment of whatever frame it was given.
 */
export function isArchitectureExemptPath(path: string): boolean {
  if (/\.test\.[tj]sx?$/.test(path)) return true;
  if (/\.gen\.[tj]sx?$|\.d\.ts$/.test(path)) return true;
  if (hasTestDirectorySegment(path)) return true;
  return path.split("/").some((segment) => segment === "scripts");
}

/**
 * True when a path sits in a test directory: `__tests__` anywhere, or the
 * cross-cutting `test/` directory at the root of the frame.
 *
 * One owner, because two callers ask the same question about different inputs —
 * `isArchitectureExemptPath` about a file on disk, `namesTestModule` about a
 * specifier. Extending the convention here reaches both.
 */
function hasTestDirectorySegment(path: string): boolean {
  const segments = path.split("/");
  return segments[0] === "test" || segments.includes("__tests__");
}

/**
 * True when a SPECIFIER names a test module.
 *
 * Separate from `isArchitectureExemptPath` on purpose, and the split is not a
 * second answer to one question: that predicate reads a file on disk, where an
 * extension is always present and `foo.test.helpers.ts` is production code. A
 * specifier carries no extension — `./invoices.test` is the ordinary spelling —
 * so the suffix arm here has to be looser, and applying the looser one to files
 * would silently widen the exemption every rule in the catalog inherits.
 *
 * The DIRECTORY half is shared, which is the half that is genuinely one
 * question.
 */
export function namesTestModule(specifierPath: string): boolean {
  return /\.test$|\.test\./.test(specifierPath) || hasTestDirectorySegment(specifierPath);
}

/** Rules that only make sense against rendered UI gate on this rather than on being in a tree. */
export function isComponentFile(filename: string): boolean {
  return filename.endsWith(".tsx");
}

/** A file resolved into the tree that governs it. */
export type FileRole = {
  tree: DeclaredTree;
  /** The file's path from that tree's source root. */
  sourcePath: string;
  /**
   * Where it sits, or undefined when nothing in the tree's vocabulary claims it.
   *
   * Undefined is the LOUD case, not a skip: `boundary/import-policy` reports it,
   * because a directory inside a declared tree that no profile claims is an area
   * with no policy. Every other rule simply finds no match, which is the same
   * answer it would give for a position it does not govern.
   */
  place: SourcePlace | undefined;
};

/**
 * The declared tree a file sits in, and its path from that tree's root.
 *
 * The most specific root wins: with `src` and `apps/web/src` both declared, a
 * file under the latter belongs to the latter. Ties on depth are broken by the
 * longer declaration, so a root declared with its disambiguating segments always
 * beats a bare one.
 *
 * Undefined means the file is in no declared tree — which is a real answer and
 * the one that makes the whole catalog silent there.
 */
export function declaredTreeFor(
  absolutePath: string,
  trees: readonly DeclaredTree[] = DECLARED_TREES,
): { tree: DeclaredTree; sourcePath: string } | undefined {
  let best: { tree: DeclaredTree; sourcePath: string; end: number } | undefined;

  for (const tree of trees) {
    const marker = `/${tree.root}/`;
    // The LAST occurrence: a checkout living under a directory called `src` is
    // far more likely than an application directory called `src` nested inside
    // one.
    const at = absolutePath.lastIndexOf(marker);
    if (at === -1) continue;
    const end = at + marker.length;
    if (
      best === undefined ||
      end > best.end ||
      (end === best.end && tree.root.length > best.tree.root.length)
    ) {
      best = { tree, sourcePath: absolutePath.slice(end), end };
    }
  }

  return best === undefined ? undefined : { tree: best.tree, sourcePath: best.sourcePath };
}

/**
 * What kind of file this is, or undefined when no rule in this catalog governs it.
 *
 * The first line of every oxlint rule in the catalog. Two unrelated reasons
 * collapse into that one undefined on purpose, because the rules answer both the
 * same way: the file is outside every declared tree, or it is architecture-exempt.
 * Neither is a violation and neither is coverage.
 *
 * Every rule keeps its own verdict logic and reads ONE answer to "what kind of
 * file is this" — deliberately vocabulary and not a second policy table. Where a
 * rule needs a name rather than a position (the token source, the DB directory)
 * it reads that from `role.tree.vocabulary`, which is the same one owner.
 */
export function classifyFileRole(
  absolutePath: string,
  trees: readonly DeclaredTree[] = DECLARED_TREES,
): FileRole | undefined {
  const found = declaredTreeFor(absolutePath, trees);
  if (found === undefined) return undefined;
  if (isArchitectureExemptPath(found.sourcePath)) return undefined;
  return {
    tree: found.tree,
    sourcePath: found.sourcePath,
    place: classifySourcePath(found.tree.vocabulary, found.sourcePath),
  };
}

/** True when `role` sits at one of `profiles`. */
export function isAtProfile(role: FileRole, ...profiles: SourcePlace["profile"][]): boolean {
  return role.place !== undefined && profiles.includes(role.place.profile);
}

/**
 * True when the file at `role` is the module named by `moduleName` — a path from
 * the tree's source root, without an extension.
 *
 * Compared as a whole path rather than a suffix, which is what the `/src/`-anchored
 * regexes it replaces were reaching for: a sibling that merely ends in the same
 * word (`legacy-theme.ts`, `shared/ui-legacy/`) is a different module and must
 * not inherit the exemption.
 */
export function isModule(role: FileRole, moduleName: string): boolean {
  return withoutSourceExtension(role.sourcePath) === moduleName;
}
