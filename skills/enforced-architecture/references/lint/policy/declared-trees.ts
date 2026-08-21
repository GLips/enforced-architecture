// ─── policy/declared-trees — which trees this project adopted the catalog for ─
//
// The one list. A declared tree is a source root plus the vocabulary that root
// uses, and BOTH tiers read this file: the oxlint rules resolve the file they
// were handed into a tree before they match anything, and the structural tier's
// `arch.config.ts` binds the same list to a project root.
//
// NEGATIVE SPACE, and it has to be in the setup docs as well as here: a tree you
// did not declare is a tree you did not adopt for. Every TREE-SCOPED rule in this
// catalog — which is every rule but `testing/no-module-mocking`, whose subject is
// a test file — is SILENT outside every declared tree — no findings, no warnings, no "unclassified"
// diagnostic — and that silence is not coverage. An undeclared package reads
// exactly like a clean one, so a repo that adds `packages/reporting/` and forgets
// this file has added an unpoliced tree and nothing will say so.
//
// ── Adapt ────────────────────────────────────────────────────────────────────
//
// One entry per tree the catalog governs. A single-app repo declares one:
//
//   export const DECLARED_TREES: ValidatedTrees = declareTrees([
//     { root: "src", vocabulary: RECOMMENDED_VOCABULARY },
//   ]);
//
// A monorepo declares one per governed source root, and each carries its OWN
// vocabulary — the app may layer features while a package spells its adapters
// differently:
//
//   export const DECLARED_TREES: ValidatedTrees = declareTrees([
//     { root: "apps/web/src", vocabulary: RECOMMENDED_VOCABULARY },
//     {
//       root: "packages/core/src",
//       vocabulary: { ...RECOMMENDED_VOCABULARY, infrastructureDir: "db" },
//     },
//   ]);
//
// `declareTrees` is not decoration: it validates each vocabulary and brands the
// list, and every consumer takes the branded type — so a declaration that skips
// it does not compile.
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
  apiClientModule,
  assertGoverningVocabulary,
  browserStorageModule,
  dbDir,
  dbSchemaPath,
  rootRouteModule,
  sharedUiDir,
  themeModule,
  topLevelDirsByField,
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
   * The tree's source root, PROJECT-RELATIVE, with no trailing slash:
   * `src`, `apps/web/src`, `packages/core/src`.
   *
   * Both tiers measure a file from the project root before comparing it against
   * this — `context.cwd` in the oxlint tier, `config.projectRoot` in the
   * structural one. A multi-segment root is therefore exact rather than a
   * disambiguating hint: `apps/web/src` and `packages/core/src` name two
   * directories, and neither can be confused with a `src` nested inside a
   * feature.
   */
  root: string;
  vocabulary: TreeVocabulary;
};

// The naming conventions the exemption reads, hoisted above the tree list
// below: `declareTrees` validates at module load and walks the exemption
// predicate to do it, so these have to be initialised before it runs.
/**
 * The suffix that makes a module a TEST, with the extension already gone.
 *
 * ONE owner, and it has to be: `naming/test-file-mirror` reads this same
 * constant to decide what it is auditing. While that check carried its own
 * configurable `testSuffixes`, a project could bless a spelling the catalog-wide
 * exemption did not recognise — the file was a test to one owner and ordinary
 * application source to every rule in both tiers.
 *
 * Not vocabulary. `.test`, `.gen` and `.d` are naming facts the ecosystem
 * already agrees on, in the same sense `.ts` is; changing one is a change to
 * this catalog. The off-convention branch of `naming/test-file-mirror` exists to
 * steer a project that spells tests some other way toward this one.
 */
export const TEST_MODULE_SUFFIX = ".test";

/**
 * What a file's name says about who wrote it, with the extension already gone:
 * `.gen` is generated, `.d` is an ambient declaration.
 *
 * A closed list of conventions, not an adopter's exemption list — each entry is
 * a naming fact the whole ecosystem already agrees on, and adding to it is a
 * change to this catalog rather than a knob a project turns.
 *
 * `TEST_MODULE_SUFFIX` is deliberately not here: it is the one exemption a check
 * can be the subject of, so it is asked separately.
 */
const UNAUTHORED_MODULE_SUFFIXES = [".gen", ".d"];

declare const VALIDATED_DECLARATION: unique symbol;

/**
 * A tree list that has been through `declareTrees`, and the type every consumer
 * of the shipped list takes.
 *
 * The brand exists because the validation was DELETABLE-GREEN. The checks used to
 * be two loose statements below the list, and a review deleted them and ran the
 * whole suite: 50/50 oxlint specs and 16/16 structural checks, exit 0 — because
 * every malformed-vocabulary case calls `assertGoverningVocabulary` directly and
 * none of them proves that the declaration itself is held to it. There is no
 * assertion that fixes that, only a shape: an unvalidated array literal is not
 * assignable here, so removing the factory call is a compile error rather than a
 * green run.
 *
 * The brand is on the ARRAY, not on its elements, and a review is why: with it on
 * the elements, `export const DECLARED_TREES: ValidatedTrees = []` satisfied the
 * type vacuously — an empty list has no element to fail — and typechecked clean
 * in both configurations, which is the whole catalog silent on every tree.
 */
export type ValidatedTrees = readonly DeclaredTree[] & {
  readonly [VALIDATED_DECLARATION]: true;
};

/**
 * The trees this project has adopted the catalog for. Edit this list; do not
 * edit a rule.
 */
export const DECLARED_TREES: ValidatedTrees = declareTrees([
  { root: "src", vocabulary: RECOMMENDED_VOCABULARY },
]);

/**
 * Validates a tree list at the point of DECLARATION and brands it, which is the
 * only way a consumer can be sure the list it was handed was checked.
 *
 * Called at module load for the shipped list, so a project whose vocabulary would
 * silence its own tree fails on the first import of this file rather than
 * reporting clean forever. A harness assertion would cover this repo's list and
 * no adopter's.
 */
export function declareTrees(trees: readonly DeclaredTree[]): ValidatedTrees {
  if (trees.length === 0) {
    throw new Error(
      `No trees declared. Every tree-scoped rule in this catalog resolves the file it is handed ` +
        `into a declared tree first, so an empty list is the whole catalog switched off with ` +
        `nothing in it saying so — and a repo in that state reads exactly like a clean one.`,
    );
  }
  for (const tree of trees) {
    assertGoverningVocabulary(tree.vocabulary, tree.root);
    assertGovernedPositionsAreNotExempt(tree.vocabulary, tree.root);
  }
  assertDistinctDeclaredRoots(trees);
  // Frozen IN PLACE rather than copied, so the caller's own reference is frozen
  // too. Validating and handing back a live array leaves the checked state
  // aliased: a review kept its literal, called this, and then reassigned
  // `trees[0].root` to a path outside the project — validated once, governing
  // somewhere else. Copying would not have closed that, because the original is
  // what the adopter's module still holds.
  return deepFreeze(trees) as ValidatedTrees;
}

/**
 * Freezes `value` and everything reachable through it, in place.
 *
 * Deep, because the mutable state that matters is nested: a vocabulary's
 * `featureLayerDirs`, its extension lists, the tree object itself. Freezing only
 * the array leaves every one of those writable through the element the array
 * already holds.
 */
function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null) return value;
  // `isFrozen` gates the FREEZE, never the descent. Gating the descent was a real
  // hole: a caller that had already shallow-frozen its own array got an immediate
  // return, and every tree and vocabulary inside it stayed writable — validated
  // once, then edited, with the brand still on the value.
  if (!Object.isFrozen(value)) Object.freeze(value);
  for (const nested of Object.values(value)) deepFreeze(nested);
  return value;
}

/**
 * Rejects a vocabulary whose own names make a governed position architecture-exempt.
 *
 * `assertGoverningVocabulary` checks SYNTAX — one segment, no glob, no extension —
 * and a review walked straight past it with names that are syntactically perfect
 * and semantically fatal: `featuresDir: "scripts"`, `featuresDir: "test"`, a
 * service layer called `scripts`, `serverModuleSuffix: ".test"` / `".gen"` /
 * `".d"`. Every one passed validation, and every representative file then came
 * back `undefined` from `classifyFileRole` — the position spelled in the
 * vocabulary as governed, exempt from every rule in the catalog, with nothing
 * saying so.
 *
 * The test is a REPRESENTATIVE PATH through the real predicate rather than a list
 * of reserved words. A reserved-word list is a second copy of the exemption
 * conventions and would drift from `isExemptByFileName` the first time either
 * moved; building the path this vocabulary implies and asking the one owner
 * cannot.
 *
 * NEGATIVE SPACE: `generatedDir` is deliberately absent. It is exempt on purpose,
 * and that exemption is bounded by the collision check in
 * `assertGoverningVocabulary` instead.
 *
 * `sourceRootPositions` and `featureRootPositions` are absent for a different
 * reason: they PERMIT a file at a position rather than govern one, and the
 * recommended vocabulary spells `sourceRootPositions.routeTree` as
 * `routeTree.gen` — a file whose own name makes it exempt whether or not it is
 * declared. Nothing is silenced by naming it.
 */
function assertGovernedPositionsAreNotExempt(vocabulary: TreeVocabulary, treeRoot: string): void {
  const unit = `${vocabulary.featuresDir}/alpha`;
  const layerPaths = Object.entries(vocabulary.featureLayerDirs).map(
    ([role, dir]) => [`featureLayerDirs.${role}`, `${unit}/${dir}/module.ts`] as const,
  );

  const positions: (readonly [string, string])[] = [
    ...Object.entries(topLevelDirsByField(vocabulary)).map(
      ([field, dir]) => [field, `${dir}/module.ts`] as const,
    ),
    ...layerPaths,
    ["sharedUiSubdir", `${sharedUiDir(vocabulary)}/Button.tsx`],
    ["clientBarrelModule", `${unit}/${vocabulary.clientBarrelModule}.ts`],
    ["serverBarrelModule", `${unit}/${vocabulary.serverBarrelModule}.ts`],
    // The suffix is the one entry that is not a position: it is spliced onto an
    // ordinary module name, so a suffix that reads as an exemption takes every
    // server-only module in the tree out of the catalog at once.
    ["serverModuleSuffix", `${unit}/charge${vocabulary.serverModuleSuffix}.ts`],
    ["themeModuleName", `${themeModule(vocabulary)}.ts`],
    ["rootRouteName", `${rootRouteModule(vocabulary)}.tsx`],
    // The composites. Each is a position two rules key on, and each is spelled
    // from a field that the top-level loop above never reaches on its own — a
    // review found all four plus the env modules by walking exactly the fields
    // the first version of this list did not.
    ["dbSubdir", `${dbDir(vocabulary)}/client.ts`],
    ["dbSchemaSubdir", `${dbSchemaPath(vocabulary)}/invoices.ts`],
    ["apiClientName", `${apiClientModule(vocabulary)}.ts`],
    ["browserStorageName", `${browserStorageModule(vocabulary)}.ts`],
    ...Object.keys(vocabulary.envModules).map(
      (module) => [`an envModules key`, `${module}.ts`] as const,
    ),
  ];

  for (const [field, path] of positions) {
    if (!isArchitectureExemptSourcePath(vocabulary, path)) continue;
    throw new Error(
      `The tree at "${treeRoot}" spells ${field} such that "${path}" is architecture-exempt — ` +
        `it reads as a test, a script, or generated output. That position is silent in both ` +
        `tiers while still being named in the vocabulary as though it were policed, which is ` +
        `exactly the undeclared-tree failure one level down. Pick a name the exemption ` +
        `conventions do not claim.`,
    );
  }
}

/**
 * Rejects a list that declares one root twice.
 *
 * Two entries at the same root is not a tree governed twice, it is a tree
 * governed by whichever vocabulary each tier happens to pick: `declaredTreeFor`
 * returns ONE match and the second entry's vocabulary never applies, while the
 * structural tier builds a context per entry and runs every check against both.
 * A repo that meant to give its second root a different vocabulary and mistyped
 * the root gets a green run in which half its declarations do nothing.
 */
export function assertDistinctDeclaredRoots(trees: readonly DeclaredTree[]): void {
  const seen = new Set<string>();
  for (const tree of trees) {
    // Compared as WRITTEN, which is only sound because a root has one spelling.
    // Both tiers now measure from the project root, so `./src` never matches the
    // project-relative `src/...` a file resolves to and the tree it declares is
    // reached by nothing. It also has to match the shipped `oxlintrc.json`
    // override glob character for character — `harness/run-rule-fixtures.ts`
    // compares the two lists — and `<root>/**` built from `./src` is a glob for a
    // directory that does not exist.
    if (tree.root !== canonicalRoot(tree.root)) {
      throw new Error(
        `The tree at "${tree.root}" is not written canonically. A root is segments joined by ` +
          `single slashes with no "./" or "../", no leading or trailing slash, and no empty ` +
          `segment: "src", "apps/web/src". Both tiers compare this string against a ` +
          `project-relative path rather than resolving it, and the shipped oxlintrc builds ` +
          `"<root>/**" from it — so a second spelling of one directory is a root nothing ` +
          `resolves to and a glob matching nothing.`,
      );
    }
    if (seen.has(tree.root)) {
      throw new Error(
        `The tree at "${tree.root}" is declared twice. A root has ONE vocabulary: the oxlint tier ` +
          `resolves a file to the first declaration and never reads the second, while the ` +
          `structural tier runs every check once per declaration — so the two tiers disagree ` +
          `about the tree's spelling and about how many times it was checked.`,
      );
    }
    seen.add(tree.root);
  }
}

/**
 * `root` with its segments joined by single slashes — or something different from `root` when it
 * was not written that way, which is the only thing the caller uses it for.
 *
 * Deliberately NOT a normalizer the caller substitutes: rewriting `./src` to `src` would leave the
 * declaration in the file saying one thing and the classifier using another, which is the same
 * two-spellings defect one indirection further away.
 */
function canonicalRoot(root: string): string {
  const segments = root.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    return `${root} (noncanonical)`;
  }
  return root;
}

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
 * NOT the whole exemption. A tree's `generatedDir` is exempt too, and it is frame-sensitive in
 * a way nothing here is — `gen` means `<root>/gen`, and which root depends on which tree. The two
 * exported wrappers below add that half, one per frame; call one of them, not this. It is private
 * so no caller can take the name-only half and believe it has the whole answer, which is how the
 * oxlint tier came to ignore `src/gen/` while the structural tier reported findings in it.
 */
function isExemptByFileName(path: string): boolean {
  return isTestPath(path) || isUnauthoredOrOutOfGraphPath(path);
}

/**
 * True when the file at `path` is a TEST — by name or by the directory it sits in.
 *
 * Split from the rest of the exemption because exactly one check has tests as its SUBJECT.
 * `naming/test-file-mirror` audits what tests are called, so it must see the files everything else
 * skips — and a single include-everything switch handed it the generated, ambient and script
 * exemptions along with the test one, which is how a generated `gen/orphan.test.ts` drew a
 * finding naming a rename nobody can perform.
 */
export function isTestPath(path: string): boolean {
  // The extension is STRIPPED before the convention is matched, never listed alongside it. A
  // regex spelling `[tj]sx?` covers four of the eight extensions the walkers accept, so
  // `a.test.mts` reads as ordinary application source and draws every boundary rule in the
  // catalog.
  const bare = withoutSourceExtension(path);
  if (bare !== path && bare.endsWith(TEST_MODULE_SUFFIX)) return true;
  return hasTestDirectorySegment(path);
}

/**
 * True when nobody wrote the file, or when what they wrote is not part of the shipped module
 * graph: a generated or ambient module by name, or a one-off script by position.
 *
 * The half of the exemption that NO check may opt out of. A finding against a generated file
 * names no edit anyone can make, and a `.d.ts` emits no runtime edge at all — so unlike the test
 * half, there is no check whose subject these could be.
 */
function isUnauthoredOrOutOfGraphPath(path: string): boolean {
  const bare = withoutSourceExtension(path);
  if (bare !== path && UNAUTHORED_MODULE_SUFFIXES.some((suffix) => bare.endsWith(suffix))) {
    return true;
  }
  return path.split("/").some((segment) => segment === "scripts");
}

/**
 * True when a file is exempt for a reason that is NOT "it is a test", in the frame of one tree.
 *
 * What `naming/test-file-mirror` walks. Generated directories are in here rather than in the
 * name-only predicate because they are per-tree vocabulary.
 */
export function isUnauthoredSourcePath(
  vocabulary: TreeVocabulary,
  pathFromSourceRoot: string,
): boolean {
  if (isUnauthoredOrOutOfGraphPath(pathFromSourceRoot)) return true;
  return namesGeneratedDir(vocabulary, pathFromSourceRoot);
}

/** True when `pathFromSourceRoot` sits in this tree's declared generated directory. */
function namesGeneratedDir(vocabulary: TreeVocabulary, pathFromSourceRoot: string): boolean {
  return isUnderPath(pathFromSourceRoot, vocabulary.generatedDir);
}

/**
 * True when the file at `pathFromSourceRoot` is outside the architecture contract, in the frame of
 * ONE declared tree. The oxlint tier's question, and the tree-scoped structural checks'.
 *
 * `generatedDir` is per-tree vocabulary, which is why this takes a vocabulary at all: a monorepo
 * whose app writes into `gen/` and whose package writes into `__generated__/` has one answer per
 * tree, and a predicate with no tree cannot give it.
 */
export function isArchitectureExemptSourcePath(
  vocabulary: TreeVocabulary,
  pathFromSourceRoot: string,
): boolean {
  if (isExemptByFileName(pathFromSourceRoot)) return true;
  return namesGeneratedDir(vocabulary, pathFromSourceRoot);
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
  return trees.some((tree) => isUnderPath(path, `${tree.root}/${tree.vocabulary.generatedDir}`));
}

/**
 * True when a path sits in a test directory: `__tests__` anywhere, or the
 * cross-cutting `test/` directory at the root of the frame.
 *
 * One owner, because three callers ask the same question about different inputs
 * — the exemption about a file on disk, `namesTestModule` about a specifier, and
 * `naming/test-file-mirror` about where a test with no sibling module is
 * legitimate. That last one replaced a configurable `orphanAllowedDirs`: a
 * directory list an adopter grows is the orphan branch switched off one entry at
 * a time, while "a cross-cutting suite lives in a test directory" is a fact
 * about the layout the catalog already recognises everywhere else.
 */
export function hasTestDirectorySegment(path: string): boolean {
  const segments = path.split("/");
  return segments[0] === "test" || segments.includes("__tests__");
}

/**
 * True when a SPECIFIER names a test module.
 *
 * Both halves are the shared owners: `TEST_MODULE_SUFFIX` and the directory
 * predicate, asked of a specifier instead of a file on disk. The only difference
 * is that a specifier usually carries no extension — `./invoices.test` is the
 * ordinary spelling — so the extension is stripped when there is one and the
 * suffix test is the same either way.
 *
 * That sameness is load-bearing. A looser suffix arm here (`\.test\.` anywhere)
 * made `foo.test.helpers` a test import while the identical file on disk was
 * production code, so one module was inside the architecture contract and
 * outside it depending on which rule was asking.
 */
export function namesTestModule(specifierPath: string): boolean {
  const bare = withoutSourceExtension(specifierPath);
  return bare.endsWith(TEST_MODULE_SUFFIX) || hasTestDirectorySegment(specifierPath);
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
 * A declared root is project-relative, so this needs the PROJECT ROOT to read
 * one: `projectRoot` is `context.cwd` in the oxlint tier and `config.projectRoot`
 * in the structural one, and the file is made project-relative before any root is
 * compared. There is no version of this that works without it — a review searched
 * the absolute path for `/${root}/` instead, and every choice about which
 * occurrence to take is wrong for some real tree. Taking the FIRST breaks a
 * checkout under a directory called `src` (`/home/me/src/repo/src/...`). Taking
 * the LAST breaks a legitimately nested one: with `src` declared,
 * `/repo/src/features/billing/service/src/helper.ts` resolved to the source-root
 * module `helper.ts`, so the two tiers gave the same file different positions and
 * different policies.
 *
 * The most specific root wins: with `src` and `apps/web/src` both declared, a
 * file under the latter belongs to the latter. Roots are canonical and
 * duplicate-free (`assertDistinctDeclaredRoots`), so "longest declaration that
 * prefixes this path" is unambiguous.
 *
 * Undefined means the file is in no declared tree — which is a real answer and
 * the one that makes the whole catalog silent there. A file outside the project
 * root entirely is the same answer for the same reason.
 */
export function declaredTreeFor(
  absolutePath: string,
  projectRoot: string,
  trees: readonly DeclaredTree[] = DECLARED_TREES,
): { tree: DeclaredTree; sourcePath: string } | undefined {
  const prefix = projectRoot.endsWith("/") ? projectRoot : `${projectRoot}/`;
  if (!absolutePath.startsWith(prefix)) return undefined;
  const projectPath = absolutePath.slice(prefix.length);

  let best: { tree: DeclaredTree; sourcePath: string } | undefined;
  for (const tree of trees) {
    const marker = `${tree.root}/`;
    if (!projectPath.startsWith(marker)) continue;
    if (best === undefined || tree.root.length > best.tree.root.length) {
      best = { tree, sourcePath: projectPath.slice(marker.length) };
    }
  }
  return best;
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
  projectRoot: string,
  trees: readonly DeclaredTree[] = DECLARED_TREES,
): FileRole | undefined {
  const found = declaredTreeFor(absolutePath, projectRoot, trees);
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

/**
 * True when the file at `role` is the module named by `moduleName` — a path from
 * the tree's source root, without an extension.
 *
 * Compared as a whole path, never as a suffix: a sibling that merely ends in the
 * same word (`legacy-theme.ts`, `shared/ui-legacy/`) is a different module and
 * must not inherit the exemption.
 */
export function isModule(role: FileRole, moduleName: string): boolean {
  return withoutSourceExtension(role.sourcePath) === moduleName;
}
