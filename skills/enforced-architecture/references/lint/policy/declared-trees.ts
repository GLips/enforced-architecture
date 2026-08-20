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
  assertGoverningVocabulary,
  barrelModules,
  classifySourcePath,
  isServerModule,
  isUnderPath,
  RECOMMENDED_VOCABULARY,
  runsOnServer,
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

// Checked at MODULE LOAD, so a project whose vocabulary would silence its own
// tree fails on the first import of this file rather than reporting clean
// forever. A harness assertion would cover this repo's list and no adopter's.
for (const tree of DECLARED_TREES) assertGoverningVocabulary(tree.vocabulary, tree.root);

/**
 * The architecture rules govern application source. Tests and one-off scripts sit outside that
 * contract on purpose: a test may import whatever it needs to exercise a seam, and a script is not
 * part of the shipped module graph.
 *
 * GENERATED and AMBIENT files are exempt for a different reason: nobody wrote them, so a finding
 * against one names no edit anyone can make. A `.d.ts` in particular declares types and emits no
 * runtime edge at all.
 *
 * ONE definition, read by both tiers, and it must stay one: a file the oxlint tier governs and the
 * structural tier does not is one edge with two answers, and the tier that skips it reports clean.
 * Two lists kept in step by a comment is the shape that fails, because nothing checks the comment.
 *
 * Every case here is a STRUCTURAL FACT about the file: how it is named, or which directory it sits
 * in. There is no list an adopting project extends, deliberately — an extensible exemption list is
 * a bypass vector, and a rule that cannot be switched off must not ship with a back door that can.
 *
 * `path` is relative to a frame the caller chooses: the tree's source root for the oxlint tier, the
 * project root for the two project-scoped structural checks. Every test but one is on a segment or
 * a suffix and reads the same in either frame; the exception is the cross-cutting `test/` directory,
 * which is only recognised at the FIRST segment of whatever frame it was given.
 *
 * NOT the whole exemption. A tree's `generatedDirs` are exempt too, and they are frame-sensitive in
 * a way nothing here is — `gen` means `<root>/gen`, and which root depends on which tree. The two
 * exported wrappers below add that half, one per frame; call one of them, not this. It is private
 * so no caller can take the name-only half and believe it has the whole answer, which is how the
 * oxlint tier came to ignore `src/gen/` while the structural tier reported findings in it.
 */
function isExemptByFileName(path: string): boolean {
  // The extension is STRIPPED before the conventions are matched, never listed
  // alongside them. A regex spelling `[tj]sx?` covers four of the eight
  // extensions the walkers accept, so `a.test.mts`, `a.gen.mts` and `a.d.cts`
  // read as ordinary application source — a generated ES module drawing findings
  // nobody can act on, and a test drawing every boundary rule in the catalog.
  const bare = withoutSourceExtension(path);
  if (bare !== path && EXEMPT_MODULE_SUFFIXES.some((suffix) => bare.endsWith(suffix))) return true;
  if (hasTestDirectorySegment(path)) return true;
  return path.split("/").some((segment) => segment === "scripts");
}

/**
 * True when the file at `pathFromSourceRoot` is outside the architecture contract, in the frame of
 * ONE declared tree. The oxlint tier's question, and the tree-scoped structural checks'.
 *
 * `generatedDirs` is per-tree vocabulary, which is why this takes a vocabulary at all: a monorepo
 * whose app writes into `gen/` and whose package writes into `__generated__/` has one answer per
 * tree, and a predicate with no tree cannot give it.
 */
export function isArchitectureExemptSourcePath(
  vocabulary: TreeVocabulary,
  pathFromSourceRoot: string,
): boolean {
  if (isExemptByFileName(pathFromSourceRoot)) return true;
  return vocabulary.generatedDirs.some((dir) => isUnderPath(pathFromSourceRoot, dir));
}

/**
 * The same question in the PROJECT frame, for the two structural checks that walk across trees
 * rather than inside one.
 *
 * Every declared tree's generated directories are exempt here, each measured from its own root:
 * `src/gen` is generated because the tree at `src` says so, and it says nothing about a `gen/`
 * directory in a tree it does not own. A path in no declared tree gets the name-only half, which is
 * the same silence the rest of the catalog gives it.
 */
export function isArchitectureExemptProjectPath(
  path: string,
  trees: readonly DeclaredTree[] = DECLARED_TREES,
): boolean {
  if (isExemptByFileName(path)) return true;
  return trees.some((tree) =>
    tree.vocabulary.generatedDirs.some((dir) => isUnderPath(path, `${tree.root}/${dir}`)),
  );
}

/**
 * What a file's name says about who wrote it, with the extension already gone:
 * `.test` is a test, `.gen` is generated, `.d` is an ambient declaration.
 *
 * A closed list of conventions, not an adopter's exemption list — each entry is
 * a naming fact the whole ecosystem already agrees on, and adding to it is a
 * change to this catalog rather than a knob a project turns.
 */
const EXEMPT_MODULE_SUFFIXES = [".test", ".gen", ".d"];

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
  if (isArchitectureExemptSourcePath(found.tree.vocabulary, found.sourcePath)) return undefined;
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
 * Compared as a whole path, never as a suffix: a sibling that merely ends in the
 * same word (`legacy-theme.ts`, `shared/ui-legacy/`) is a different module and
 * must not inherit the exemption.
 */
/**
 * True when the file at `role` runs on the SERVER — by position, or by being a
 * server-only module.
 *
 * The whole question, in one place, because three rules each held a copy of it
 * and each copy paired a profile list with its own `/\.server\.[tj]sx?$/`.
 * Position and suffix are separately meaningful (`policy/layout.ts` owns each
 * half), and a caller that wants only one half calls that half directly — but a
 * rule asking "is this a client context" wants both, and asking for both is what
 * kept drifting.
 */
export function isServerContext(role: FileRole): boolean {
  return (
    isServerModule(role.tree.vocabulary, role.sourcePath) ||
    (role.place !== undefined && runsOnServer(role.place.profile))
  );
}

/**
 * True when the file at `role` IS one of its tree's barrels — the client one or
 * the server one, in any directory.
 *
 * A barrel's name is vocabulary, so this reads it rather than testing a literal
 * `/index.tsx`. Unlike `isModule`, the comparison is on the last segment: a
 * barrel is a barrel wherever it sits, and every directory has its own.
 */
export function namesBarrel(role: FileRole): boolean {
  const bare = withoutSourceExtension(role.sourcePath);
  const filename = bare.slice(bare.lastIndexOf("/") + 1);
  return barrelModules(role.tree.vocabulary).includes(filename);
}

export function isModule(role: FileRole, moduleName: string): boolean {
  return withoutSourceExtension(role.sourcePath) === moduleName;
}
