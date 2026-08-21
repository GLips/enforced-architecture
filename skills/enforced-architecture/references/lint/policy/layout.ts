// ─── policy/layout — what a tree is called, and where a file sits in one ─────
//
// The vocabulary both enforcement tiers share, as a VALUE rather than as a set
// of module constants. One `TreeVocabulary` describes one declared tree: how its
// directories are spelled, how deep its feature layers go, which files may sit
// at its root. `policy/declared-trees.ts` is the list of trees a project has
// adopted, and every classifier here takes the vocabulary of the tree the file
// was resolved into.
//
// It is deliberately BELOW both tiers: no runtime APIs, no oxlint ESTree types,
// no import from `../structural/` or `../oxlint/`. Plain strings, records,
// discriminated unions, pure functions.
//
// That constraint is a CONVENTION and NOTHING enforces it: both tooling
// tsconfigs include this directory under the same `types`, so the second
// program cannot catch what the first one lets through. A `node:` import, an
// oxlint type, a reach into `../oxlint/` — all compile clean and all are caught
// by review or by nothing. Make the rule mechanical the first time one lands in
// a diff, rather than asking this paragraph to hold it.
//
// Everything here speaks ONE currency: a path from a tree's source root, with no
// leading slash and no extension needed — `features/billing/repo/invoice-rows`.
// That is what makes the two callers interchangeable. The resolved import graph
// produces it by resolving a relative specifier and taking `relative(root, …)`;
// an alias specifier becomes the identical string by slicing the alias prefix.
// One classifier, one evaluator, two ways of obtaining its input.
//
// ── Adapt ────────────────────────────────────────────────────────────────────
//
// Renaming a top-level directory, renaming a feature layer, or moving a source
// root is a change to the tree's vocabulary in `declared-trees.ts` and nowhere
// else. The policy table in `import-policy.ts` is keyed by the ROLES below, so
// the spelling is free to move and the set of positions is not.
//
// ── What is vocabulary and what is not ───────────────────────────────────────
//
// A role is fixed; its spelling is vocabulary. `FEATURE_LAYER_ROLES` is the
// closed set of positions inside a feature and their ORDER, and it is shared by
// every tree because `import-policy.ts` has one row per position — adding a
// fifth layer is a compile error until that row is filled in, which is the
// property a bare `string[]` of layer names could not offer. Renaming `service/`
// to `usecases/` is a different act entirely: it moves one string in one tree's
// `featureLayerDirs` and every classifier, every rank comparison and every
// message follows.
//
// Do not collapse the two into a single ordered list of directory names. The
// ORDER is a shared fact about the architecture and the NAMES are a tree's own,
// so one list makes a rename look like a reordering: the structural tier follows
// the new names while the oxlint tier's profiles, which key on role, do not
// notice — and both tiers report clean about different trees.
//
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The positions inside a feature, highest to lowest. Fixed across every declared
 * tree, because `import-policy.ts` states one row per position: a project adding
 * a sixth position adds it here and fills its row, and a project RENAMING one
 * edits `featureLayerDirs` in its tree's vocabulary instead.
 *
 * `placement/layer-direction` reads the ORDER to judge direction and
 * `boundary/layer-occupancy` reads the last entry as the data layer; the
 * classifiers here read membership only, because a position's rank is a question
 * about two ends of one feature and never reaches the policy table.
 */
export const FEATURE_LAYER_ROLES = ["ui", "controllers", "service", "repo"] as const;
export type FeatureLayerRole = (typeof FEATURE_LAYER_ROLES)[number];

/**
 * The non-barrel positions a feature ROOT may hold, and the entrypoint positions
 * a source ROOT may hold — closed, exactly like `FEATURE_LAYER_ROLES` and for
 * the harder reason.
 *
 * These were two `string[]` fields an adopter appended to. That is an off-switch
 * in a name's costume, and a review proved it rather than argued it: adding one
 * entry, `"helpers"`, erased both real `placement/topology` findings —
 * `["src/features/scanner/helpers.mts", "src/features/scanner/helpers.ts"]`
 * became `[]` — with no rule edited and the run green. A misplaced file is
 * legalised by naming it.
 *
 * Keyed by role, the same knob does the thing it was always meant to do and
 * nothing else: a tree calling its client entrypoint `main` moves one string,
 * and a tree wanting a new KIND of root file has to add the role here, where
 * every reader of it is a compile error until the position is understood.
 */
export const FEATURE_ROOT_ROLES = ["errors"] as const;
export type FeatureRootRole = (typeof FEATURE_ROOT_ROLES)[number];

export const SOURCE_ROOT_ROLES = ["router", "clientEntry", "serverEntry", "routeTree"] as const;
export type SourceRootRole = (typeof SOURCE_ROOT_ROLES)[number];

/**
 * How ONE declared tree spells the layout. Every field is a name, a filename, or
 * a list of them — never a pattern. A regex or a glob here would be an
 * off-switch in a costume: it can be narrowed until a rule matches nothing while
 * the tree still reads as adopted.
 *
 * Two trees in one repo may spell things differently; what they cannot do is
 * disagree about which POSITIONS exist, because those come from the shared role
 * set above and from `SourceProfile` below.
 */
export type TreeVocabulary = {
  /** How this tree's source root is spelled in a module specifier. `@/features/x`. */
  aliasPrefix: string;

  routesDir: string;
  featuresDir: string;
  domainsDir: string;
  infrastructureDir: string;
  sharedDir: string;
  /**
   * The UI subdirectory INSIDE `sharedDir`, as a single segment. `sharedUiDir()`
   * joins the two. Stored as a segment rather than as `shared/ui`, because a
   * project renaming `shared/` to `common/` would otherwise have to remember to
   * rewrite the composite too — and the classifier that reads the composite and
   * the one that reads the parent would then disagree about the same directory.
   */
  sharedUiSubdir: string;

  /**
   * The directory each feature position is spelled as. Keyed by role, so a
   * rename cannot leave a rule matching a directory that no longer exists — the
   * key stays, the value moves, and `orderedLayerDirs` follows.
   */
  featureLayerDirs: Record<FeatureLayerRole, string>;

  /**
   * How this tree spells each `FEATURE_ROOT_ROLES` position, without extensions.
   * `featureRootModules()` adds the two barrels, which are already named by
   * `clientBarrelModule`/`serverBarrelModule` — spelling them here too meant a
   * renamed barrel was still permitted under its old name by topology while
   * every other rule had followed the rename.
   *
   * `placement/topology` reads it; `classifySourcePath` deliberately does not —
   * see its `feature-root` arm for why a root file this record rejects still
   * gets an import policy.
   */
  featureRootPositions: Record<FeatureRootRole, string>;

  /**
   * The two public barrels of a unit, without extensions. Two named fields
   * rather than a list, because WHICH of them a caller may name is a real
   * distinction three rules key on: `api/server-import-context` decides who may
   * name the server barrel and `api/barrel-direction` decides whether the client
   * one may name it. A bare list makes both of those rules pick an element by
   * index.
   */
  clientBarrelModule: string;
  serverBarrelModule: string;

  /**
   * The suffix that marks a MODULE as server-only, without an extension:
   * `.server`, so `charge.server.ts` is one and `charge.ts` is not.
   *
   * A name rather than a regex, and read by every rule that asks "does this file
   * run on the server" — three of them once spelled `/\.server\.[tj]sx?$/`
   * privately, which both forked the answer and hardcoded four extensions while
   * the walkers had eight. A tree that marks server modules `.node` sets this and
   * all three follow.
   */
  serverModuleSuffix: string;

  /**
   * Env modules, and which exposure each one carries. The split is not cosmetic:
   * `directory-model.md`'s recommended setup puts secrets in `env.server.ts` and
   * `VITE_PUBLIC_*` in `env.client.ts`, and the import table answers the two
   * columns differently in four of its twelve rows — a route, a feature's `ui/`,
   * `shared/` and `shared/ui/` may each read the client env and none of them may
   * read the server one.
   *
   * A project on the SINGLE-env option (one `env.ts`) maps that file here. It is
   * listed as `env-server` because a combined module still carries the secrets,
   * and a combined module read from a client context is the leak the split
   * exists to prevent.
   */
  envModules: Record<string, "env-server" | "env-client">;

  /**
   * How this tree spells each `SOURCE_ROOT_ROLES` position, without extensions.
   * `sourceRootModules()` adds the env modules and the token stylesheet, which
   * are already named elsewhere in this vocabulary.
   *
   * A DECLARED set is what stops the last arm of `classifyTargetPath` from
   * being "anything left over". One path segment is ambiguous by construction —
   * the classifier cannot tell the file `src/lib.ts` from the directory
   * `src/lib/` — so with nothing declared, `@/lib` reads as a source-root file
   * and reaches `source-root`'s permissive row while `@/lib/format-date`
   * correctly reports `unclassifiedTarget`. Let a root file be legalised by
   * spelling — `src/lib.ts` — and every route can reach an unpoliced tree
   * through the bare `@/lib`.
   *
   * `placement/topology` reads the same set as the files permitted at the root,
   * so a project renaming an entrypoint renames it once — and a project that
   * adopted only the oxlint tier has no topology check at all, which is the
   * other half of the argument for these names living here rather than in that
   * check's config.
   */
  sourceRootPositions: Record<SourceRootRole, string>;

  /**
   * The extensions that make a file a STYLESHEET, without the dot.
   *
   * Two checks read it — `style/css-tokens` walks these files, `style/shadow-source`
   * decides which of two property spellings to look for by whether a file is one
   * — and each used to carry its own list, so a project adopting `.scss` could
   * have its stylesheets scanned for shadows and not for raw colours.
   *
   * Every entry must also be an `assetExtensions` entry: a stylesheet is an
   * asset from the IMPORT side, and a tree that scans `.scss` files while the
   * boundary rules read `@/x.scss` as an unclassified module target is one tree
   * with two answers about the same file.
   */
  stylesheetExtensions: string[];

  /**
   * The stylesheet at this tree's source root that DEFINES the tokens, with its
   * extension. `style/css-tokens` exempts it and nothing else.
   *
   * Singular, and that is the point: a list of exempt stylesheets is an
   * exemption an adopter grows one entry at a time until the check has no
   * subject left. A token source is one file by the same argument the check
   * makes — if the raw values live in two places, changing a colour means
   * finding both.
   *
   * `sourceRootModules()` includes it, so it is also permitted at the root
   * without being named a second time.
   */
  tokenStylesheetName: string;

  /**
   * Specifier suffixes that resolve inside the source root but are not module
   * edges. Load-bearing rather than defensive: a stylesheet or an image imported
   * for its URL otherwise surfaces as a crossing with a filename where an area
   * name should be.
   *
   * A documented adaptation point, and shared vocabulary rather than a per-tier
   * knob: both tiers read this one list, so a project adding `.mp4` adds it once
   * and neither tier starts reporting a video as an unclassified target.
   */
  assetExtensions: string[];

  /**
   * THE directory of generated output, relative to this tree's source root.
   *
   * For the code generators that do not stamp `.gen` on each file and write a
   * whole directory instead — a route tree, a GraphQL client, protobuf stubs.
   * The `.gen` convention is a fact about a file and needs no vocabulary; a
   * directory name is vocabulary, because only the project knows where its
   * generator writes.
   *
   * ONE name, not a list, and that is the load-bearing part. Everything under
   * this directory is exempt from every rule in the catalog, so a list is an
   * exemption an adopter can GROW — the menu re-entering through the back door,
   * one `generatedDirs.push` at a time, each entry individually defensible. A
   * project whose generators write to two places points them at one directory:
   * shaping the tree to fit is the adoption this catalog asks for. Renaming it is
   * vocabulary; having a second is not.
   *
   * THREE things read it, and they must agree. `isArchitectureExemptSourcePath`
   * and `isArchitectureExemptProjectPath` make the catalog's own rules silent
   * there, in both tiers — a file the linter ignores and the structural tier
   * reports is one file with two verdicts, and that is exactly what happened
   * while only the ignore pattern read this. The third is the shipped
   * `oxlintrc.json`, whose `ignorePatterns` the harness derives from this name so
   * the BUILT-IN `typescript/` and `sonarjs/` rules stay quiet too — they know
   * nothing about either predicate, so without it an adopting project lints its
   * own generator's output on day one.
   *
   * One directory NAME, checked at module load: the harness builds
   * `<root>/<dir>/**` from it, so a value carrying glob syntax writes the pattern
   * rather than naming a directory, and `**` would silence the whole tree with
   * nothing appearing to be turned off.
   */
  generatedDir: string;

  /**
   * The database directory inside `infrastructureDir`, and the schema directory
   * inside that — single segments, joined by `dbDir()` and `dbSchemaPath()`.
   *
   * Two rules read the joins: `boundary/db-isolation` builds its specifier test
   * from `dbDir()`, and `boundary/layer-occupancy` gates a schema import from any
   * layer above the lowest one on `dbSchemaPath()`. A project with a flat `@/db`
   * moves it here once instead of editing a regex in one rule and a config key in
   * another, which is how the two end up fencing different paths while both
   * report clean.
   */
  dbSubdir: string;
  dbSchemaSubdir: string;

  /**
   * The two capability owners inside `infrastructureDir`, as single segments.
   * `apiClientModule()` and `browserStorageModule()` join them.
   *
   * They own a capability no import can fence, which is what
   * `boundary/ambient-globals` reads them for: it reports `fetch` outside the API
   * client and `localStorage` outside the storage wrapper. Vocabulary rather than
   * a rule-local constant because they are positions in THIS tree — a project
   * whose adapters sit elsewhere renames the parent once and both follow.
   */
  apiClientName: string;
  browserStorageName: string;

  /**
   * The module holding the design tokens, and the route module that mounts the
   * app's render tree. Both are exemptions the style rules need and neither is a
   * layer: the token source DEFINES the raw values a token resolves to, and the
   * root route is where the primitives are first composed.
   */
  /** The token source inside `sharedUiDir()`, as a single segment. `themeModule()` joins them. */
  themeModuleName: string;
  /** The root route inside `routesDir`, as a single segment. `rootRouteModule()` joins them. */
  rootRouteName: string;
};

/**
 * The layout `directory-model.md` recommends, as the vocabulary a project starts
 * from. A project that calls `domains/` `core/`, or routes its pages from `app/`
 * rather than `routes/`, edits its tree's copy of this in `declared-trees.ts`
 * and nothing else: every classifier, every row of the table, and both tiers
 * read it from there.
 */
export const RECOMMENDED_VOCABULARY: TreeVocabulary = {
  aliasPrefix: "@/",

  routesDir: "routes",
  featuresDir: "features",
  domainsDir: "domains",
  infrastructureDir: "infrastructure",
  sharedDir: "shared",
  sharedUiSubdir: "ui",

  featureLayerDirs: {
    ui: "ui",
    controllers: "controllers",
    service: "service",
    repo: "repo",
  },

  featureRootPositions: { errors: "errors" },

  clientBarrelModule: "index",
  serverBarrelModule: "index.server",
  serverModuleSuffix: ".server",

  envModules: {
    "env.server": "env-server",
    "env.client": "env-client",
    env: "env-server",
  },

  generatedDir: "gen",

  sourceRootPositions: {
    router: "router",
    clientEntry: "client",
    serverEntry: "server",
    routeTree: "routeTree.gen",
  },

  stylesheetExtensions: ["css"],
  tokenStylesheetName: "styles.css",

  assetExtensions: [
    "css",
    "scss",
    "svg",
    "png",
    "jpg",
    "jpeg",
    "gif",
    "webp",
    "avif",
    "woff",
    "woff2",
    "ttf",
    "otf",
  ],

  dbSubdir: "db",
  dbSchemaSubdir: "schema",

  apiClientName: "api-client",
  browserStorageName: "browser-storage",

  themeModuleName: "theme",
  rootRouteName: "__root",
};

/**
 * Extensions that make a file SOURCE, for every walker in either tier.
 *
 * One list, because six structural checks used to spell their own and three
 * disagreed: `placement/topology`, whose entire claim is that nothing escapes
 * it, did not walk `.mts`, and `graph/feature-deps` and `graph/domain-cycles`
 * did not count an `.mts`-only feature as a node — so a cycle through one was
 * not a cycle. A per-check glob is a per-check scope, and the mismatch is
 * invisible because every copy still runs green.
 */
export const SOURCE_EXTENSIONS = ["ts", "tsx", "mts", "cts", "js", "jsx", "mjs", "cjs"];

/**
 * The source extensions that can hold JSX, which is what "this file renders UI"
 * means without a type checker.
 *
 * DERIVED rather than spelled, and the derivation is the point: a hand-written
 * copy of two entries out of the eight is how a `.jsx` file comes to be governed
 * by every rule in the catalog except the ones keyed on rendering, which then
 * report nothing about it and read as clean. That is the defect commit `ba33135`
 * fixed for `isTestPath` and for the commit gate's glob, one predicate over.
 *
 * The `sx` suffix is the whole test rather than a pair of literals, so an
 * extension added to the source list arrives here on the same terms: it renders
 * if its name says it does.
 */
export const JSX_SOURCE_EXTENSIONS = SOURCE_EXTENSIONS.filter((extension) =>
  extension.endsWith("sx"),
);

/**
 * The source extensions that carry TYPE SYNTAX, which is the subject of the
 * `types/` tag and of nothing else in the catalog.
 *
 * Derived on the same terms as `JSX_SOURCE_EXTENSIONS`, and the tail is the
 * whole test: `ts`, `tsx`, `mts` and `cts` all end in a `ts` optionally followed
 * by an `x`, and none of `js`/`jsx`/`mjs`/`cjs` does.
 *
 * A `.js` file is not a narrower subject here, it is NO subject: it has no
 * annotation to widen, no assertion to chain, and no type alias to declare. It
 * is also the one file TypeScript may structurally refuse to compile — a
 * `rates.js` beside a `rates.ts` is shadowed and never enters the program — so
 * measuring type coverage over it would report the tsconfig as broken on a
 * project where nothing is wrong.
 */
export const TYPESCRIPT_SOURCE_EXTENSIONS = SOURCE_EXTENSIONS.filter((extension) =>
  /tsx?$/.test(extension),
);

/**
 * One extension set, as the glob that matches it.
 *
 * A brace alternation with ONE alternative is not one — `*.{css}` matches
 * nothing under `node:fs`'s glob, which expands `{a,b}` and leaves `{a}` as
 * literal text. Every extension list here is derived from a project's
 * vocabulary, so any of them is one entry long in some project: a repo with
 * `stylesheetExtensions: ["css"]` walked `**\/*.{css}`, matched zero files, and
 * `style/css-tokens` reported it clean. The list being short is not a reason for
 * a check to stop applying.
 *
 * One owner for the join, rather than the four call sites that each spelled it,
 * because this is the kind of defect that is invisible in the tree that has two
 * extensions and total in the tree that has one.
 */
export function extensionGlob(extensions: string[]): string {
  return extensions.length === 1 ? `*.${extensions[0]}` : `*.{${extensions.join(",")}}`;
}

/** Every type-carrying source file in a tree: `**\/*.{ts,tsx,mts,cts}`. */
export const TYPESCRIPT_FILE_GLOB = `**/${extensionGlob(TYPESCRIPT_SOURCE_EXTENSIONS)}`;

/**
 * Every source file in ONE directory: `*.{ts,tsx,mts,cts,…}`.
 *
 * A check that knows the DEPTH of its subject composes this rather than writing
 * its own extension list at that depth. `naming/barrel-discoverability` knows a
 * barrel sits exactly one directory below a subdivided root; naming the barrel
 * module and its extension in the same glob narrows it to one of the eight
 * extensions this tier walks, and an `index.mts` barrel is then a file the check
 * never opens rather than a barrel it clears.
 */
export const SOURCE_EXTENSION_GLOB = extensionGlob(SOURCE_EXTENSIONS);

/** The one glob every whole-tree source walk uses. `**\/*.{ts,tsx,mts,cts,…}`. */
export const SOURCE_FILE_GLOB = `**/${SOURCE_EXTENSION_GLOB}`;

/**
 * Every position a file can occupy. Exhaustive by construction: the policy table
 * is keyed by this union, so a new profile is a compile error until its whole row
 * is decided. A file under a declared tree that matches none of these is
 * UNCLASSIFIED, which is the loud case — a new top-level directory must not enter
 * the app as an area nothing polices.
 *
 * The `feature-*` arms name ROLES, not directories: a tree that spells its
 * service layer `usecases/` still produces `feature-service`, because what the
 * table decides is what that position may import and not what it is called.
 */
export type SourceProfile =
  | "route"
  | "feature-barrel"
  | "feature-root"
  | "feature-ui"
  | "feature-controllers"
  | "feature-service"
  | "feature-repo"
  | "domain"
  | "infrastructure"
  | "shared"
  | "shared-ui"
  | "source-root";

/**
 * True when a position may carry presentation, so the style tier has a subject
 * there.
 *
 * ONE owner for a question three style rules used to answer separately and
 * inconsistently: `style/no-inline-color` and `style/no-inline-font-size` each
 * carried a private `/\/src\/domains\//` exemption while
 * `style/no-arbitrary-class-values` had none, and nothing recorded whether the
 * asymmetry was a decision or an omission. It was an omission.
 *
 * The domain layer is the one position the layout defines as carrying no
 * presentation at all — `import-policy.ts`'s `domain` row denies `shared-ui`
 * outright, so a domain cannot even reach a primitive. Every other position
 * either renders or composes something that does, which is why this is stated as
 * the single exclusion rather than as a list of the positions that do.
 *
 * NEGATIVE SPACE: this says nothing about the token SOURCE or the render
 * boundary. Those are named modules rather than positions, and each style rule
 * reads them off its tree's vocabulary.
 */
export function carriesPresentation(profile: SourceProfile): boolean {
  return profile !== "domain";
}

/**
 * Rejects a vocabulary whose names would silence the tree it belongs to. Throws,
 * and throwing is the point: every case here is a value that reads like an unset
 * field and behaves like a rule deleted, so a run that reported nothing would be
 * indistinguishable from a clean one.
 *
 * Checked at MODULE LOAD by `declared-trees.ts`, which is what makes it an
 * adopting project's problem on its first import rather than this repo's problem
 * in its own harness.
 *
 * Three kinds of value are refused. A name that is not one segment, because the
 * classifiers compare it against one. A name that COLLIDES with another,
 * because the classifiers take the first match and a collision therefore erases
 * a position rather than failing. And a value that makes a predicate a
 * tautology — the empty string is the prefix of every specifier, the suffix of
 * every filename and the tail of every path, and an empty list is a walk over
 * nothing.
 */
export function assertGoverningVocabulary(vocabulary: TreeVocabulary, treeRoot: string): void {
  // Every name that has to BE one segment, checked before anything compares
  // them: a field holding `a/b` or `gen*` is not a name this vocabulary can
  // reason about, and the comparisons below would be comparing patterns.
  for (const [field, name] of Object.entries(namedSegments(vocabulary))) {
    if (isSafeDirectorySegment(name)) continue;
    throw new Error(
      `The tree at "${treeRoot}" spells ${field} as "${name}", which is not a single path ` +
        `segment. Every name in this vocabulary is one segment — the classifiers compare it ` +
        `against one, so a value carrying "/" or a glob matches nothing and the position it ` +
        `names becomes an area no rule claims.`,
    );
  }

  // A name collision does not fail — it ERASES. `classifySourcePath` matches the
  // top-level directories in order and takes the first, so `domainsDir` spelled
  // the same as `featuresDir` classifies every domain as a feature: the domain
  // rules go quiet, the feature rules report on the wrong subject, and the run
  // is green. Same for the layers, where duplicate spellings collapse every
  // position onto whichever role is listed first.
  assertDistinctNames(treeRoot, topLevelDirsByField(vocabulary), "top-level position");
  assertDistinctNames(treeRoot, vocabulary.featureLayerDirs, "feature layer");
  assertDistinctNames(
    treeRoot,
    {
      clientBarrelModule: vocabulary.clientBarrelModule,
      serverBarrelModule: vocabulary.serverBarrelModule,
    },
    "barrel",
  );

  if (vocabulary.aliasPrefix === "") {
    throw new Error(
      `The tree at "${treeRoot}" declares an empty aliasPrefix. Every specifier starts with the ` +
        `empty string, so every package import would read as a module inside this tree and every ` +
        `import rule would police a path that does not exist.`,
    );
  }

  // Every MODULE name is spelled the way a specifier spells it: no extension.
  // `isSafeDirectorySegment` cannot catch this, because a dot is legal in a name
  // (`index.server`, `routeTree.gen`) and only a SOURCE extension is wrong here.
  // The failure is silent in both directions: `clientBarrelModule: "index.ts"`
  // makes `features/x/index.ts` classify as a feature ROOT rather than a barrel,
  // and sends the barrel walkers looking for `index.ts.ts`.
  for (const [field, name] of Object.entries(moduleNames(vocabulary))) {
    if (withoutSourceExtension(name) === name) continue;
    throw new Error(
      `The tree at "${treeRoot}" spells ${field} as "${name}", which carries a source extension. ` +
        `Module names here are spelled the way an import spells them — "index", "index.server" — ` +
        `because the classifiers strip the extension off the FILE before comparing. A name that ` +
        `carries one matches no file, and the position it names stops being recognised at all.`,
    );
  }

  // A dotted literal, one dot, no separators and no source extension. The
  // length-and-leading-dot version of this accepted ".server.ts", ".server/" and
  // ".*", each of which classifies `charge.server.ts` as a CLIENT module while
  // reading as though the suffix had merely been renamed.
  if (!/^\.[A-Za-z0-9][A-Za-z0-9-]*$/.test(vocabulary.serverModuleSuffix)) {
    throw new Error(
      `The tree at "${treeRoot}" spells serverModuleSuffix as "${vocabulary.serverModuleSuffix}". ` +
        `It is one dotted word on a module name — ".server", ".node" — with no extension and no ` +
        `separator. An empty one ends every filename, so every file in the tree reads as ` +
        `server-only and the three rules that ask "is this a client context" have no client left ` +
        `to find; one carrying an extension or a slash matches no file at all, and every ` +
        `server-only module in the tree reads as client-safe.`,
    );
  }

  for (const [field, extensions] of Object.entries({
    assetExtensions: vocabulary.assetExtensions,
    stylesheetExtensions: vocabulary.stylesheetExtensions,
  })) {
    for (const extension of extensions) {
      if (isSafeExtension(extension)) continue;
      throw new Error(
        `The tree at "${treeRoot}" lists "${extension}" in ${field}, which is not an extension. ` +
          `Entries are bare, without the dot — "css", "png". An empty entry matches every ` +
          `specifier suffix, and a glob is composed straight into a walk.`,
      );
    }
  }

  if (vocabulary.stylesheetExtensions.length === 0) {
    throw new Error(
      `The tree at "${treeRoot}" declares no stylesheetExtensions. Both CSS checks walk this ` +
        `list, so an empty one is those checks switched off with nothing in the config saying ` +
        `so — and the tier has no other way to find a stylesheet.`,
    );
  }
  for (const extension of vocabulary.stylesheetExtensions) {
    if (vocabulary.assetExtensions.includes(extension)) continue;
    throw new Error(
      `The tree at "${treeRoot}" names "${extension}" a stylesheet extension but not an asset ` +
        `extension. A stylesheet is an asset from the import side, so the CSS checks would read ` +
        `the file while the boundary rules reported every import of it as an unclassified ` +
        `module target.`,
    );
  }

  // `generatedDir` is segment-checked with every other name above, via
  // `namedSegments`. What is specific to it is the COLLISION: a governed position
  // handed the generated exemption is the whole position going silent while it is
  // still spelled in the vocabulary as though it were policed. `assertDistinctNames`
  // cannot own this one — it refuses a duplicate among peers, and this is a name
  // from one group matching a name in another.
  const generatedCollision = Object.entries(topLevelDirsByField(vocabulary)).find(
    ([, name]) => name === vocabulary.generatedDir,
  );
  if (generatedCollision !== undefined) {
    throw new Error(
      `The tree at "${treeRoot}" spells generatedDir as "${vocabulary.generatedDir}", which is ` +
        `also its ${generatedCollision[0]}. Everything under the generated directory is exempt ` +
        `from every rule in the catalog, so this hands a whole governed position the exemption — ` +
        `silently, and with the position still spelled in the vocabulary as though it were ` +
        `policed.`,
    );
  }
}

/**
 * The tree's five top-level positions, by the field that spells each.
 *
 * Built here rather than spelled at each caller, because the set is what
 * `classifySourcePath` matches a first segment against: a position added to that
 * classifier and not to this map is a position whose name may collide with
 * another's and erase it.
 */
export function topLevelDirsByField(vocabulary: TreeVocabulary): Record<string, string> {
  return {
    routesDir: vocabulary.routesDir,
    featuresDir: vocabulary.featuresDir,
    domainsDir: vocabulary.domainsDir,
    infrastructureDir: vocabulary.infrastructureDir,
    sharedDir: vocabulary.sharedDir,
  };
}

/**
 * How each field of the vocabulary is validated, and where its names live inside
 * the value.
 *
 *   segment         one directory name
 *   segment-record  a record whose VALUES are directory names
 *   module          one module name, spelled the way an import spells it
 *   module-record   a record whose VALUES are module names, keyed by role
 *   module-keys     a record whose KEYS are module names
 *   own             validated by a rule of its own further up — a prefix, a
 *                   suffix, an extension list, a filename with an extension
 *
 * Typed as `Record<keyof TreeVocabulary, …>`, and that is the whole point of it
 * existing. The two builders below used to repeat this classification by hand,
 * and their own comment admitted the consequence: a module field added to the
 * vocabulary and forgotten here was a name NEITHER loop checked, with nothing to
 * say so. Now adding a field to `TreeVocabulary` is a compile error until it is
 * classified, and the classification is read rather than restated.
 */
const VOCABULARY_FIELD_KINDS: Record<
  keyof TreeVocabulary,
  "segment" | "segment-record" | "module" | "module-record" | "module-keys" | "own"
> = {
  aliasPrefix: "own",
  serverModuleSuffix: "own",
  stylesheetExtensions: "own",
  assetExtensions: "own",
  // A filename WITH its extension, unlike every module name here — it names a
  // stylesheet, and `stylesheetExtensions` is what says which extensions those
  // are. Checked by the token-source rules that read it rather than by shape.
  tokenStylesheetName: "own",

  routesDir: "segment",
  featuresDir: "segment",
  domainsDir: "segment",
  infrastructureDir: "segment",
  sharedDir: "segment",
  sharedUiSubdir: "segment",
  dbSubdir: "segment",
  dbSchemaSubdir: "segment",
  generatedDir: "segment",
  featureLayerDirs: "segment-record",

  clientBarrelModule: "module",
  serverBarrelModule: "module",
  apiClientName: "module",
  browserStorageName: "module",
  themeModuleName: "module",
  rootRouteName: "module",
  featureRootPositions: "module-record",
  sourceRootPositions: "module-record",
  envModules: "module-keys",
};

/**
 * Every field whose value must be exactly one path segment, by field name.
 *
 * The module names are in here as well as in their own loop, because a module
 * name is a segment first: it has to be one before "does it carry an extension"
 * is even a coherent question.
 */
function namedSegments(vocabulary: TreeVocabulary): Record<string, string> {
  return { ...vocabularyNames(vocabulary, "segment"), ...moduleNames(vocabulary) };
}

/**
 * Every field that names a MODULE, by the field that spells it — the record
 * fields flattened as `field.role` (or `field[i]` where the KEYS are the names)
 * so a bad entry's error says which one.
 *
 * Separate from the directory names because module names carry a second
 * obligation the directories do not: no source extension.
 */
function moduleNames(vocabulary: TreeVocabulary): Record<string, string> {
  return vocabularyNames(vocabulary, "module");
}

/** The names of every field classified as `subject`, flattened to field label → name. */
function vocabularyNames(
  vocabulary: TreeVocabulary,
  subject: "segment" | "module",
): Record<string, string> {
  const names: Record<string, string> = {};
  for (const [field, kind] of Object.entries(VOCABULARY_FIELD_KINDS)) {
    const value = vocabulary[field as keyof TreeVocabulary];
    if (kind === subject) {
      names[field] = value as string;
    } else if (subject === "segment" && kind === "segment-record") {
      for (const [key, name] of Object.entries(value as Record<string, string>)) {
        names[`${field}.${key}`] = name;
      }
    } else if (subject === "module" && kind === "module-record") {
      for (const [role, name] of Object.entries(value as Record<string, string>)) {
        names[`${field}.${role}`] = name;
      }
    } else if (subject === "module" && kind === "module-keys") {
      Object.keys(value as object).forEach((name, index) => {
        names[`${field}[${index}]`] = name;
      });
    }
  }
  return names;
}

/** Throws when two of `names` share a spelling, naming both fields and what the collision erases. */
function assertDistinctNames(
  treeRoot: string,
  names: Record<string, string>,
  subject: string,
): void {
  const seen = new Map<string, string>();
  for (const [field, name] of Object.entries(names)) {
    const first = seen.get(name);
    if (first !== undefined) {
      throw new Error(
        `The tree at "${treeRoot}" spells both ${first} and ${field} as "${name}". Each ${subject} ` +
          `is matched by name and the first match wins, so one of them can never be reached: its ` +
          `rules report nothing and the other's report on files that are not their subject.`,
      );
    }
    seen.set(name, field);
  }
}

/**
 * True when `extension` is a bare file extension: letters and digits, nothing else.
 *
 * An ALLOWLIST, not a list of banned characters. A review defeated the banned-character
 * version by writing `{ts,tsx}`: brace expansion, character classes and negation are all
 * glob syntax the ban list did not name, and each one turns the walk this composes into
 * a pattern the vocabulary never declared. Enumerating what a name may contain cannot be
 * defeated by a syntax nobody thought of.
 *
 * The empty string is the case worth naming — as an extension it is the suffix
 * of every filename, so one empty entry turns a suffix test into a tautology.
 */
function isSafeExtension(extension: string): boolean {
  return /^[A-Za-z0-9]+$/.test(extension);
}

/**
 * True when `segment` names ONE directory or module and nothing else.
 *
 * An ALLOWLIST of the characters a name may contain, deliberately, because the
 * banned-character version of this was defeated: it refused `*` and `?` and
 * accepted `{features,gen}`, which the harness composed straight into
 * `src/{features,gen}/**` and thereby exempted a governed position. Brace
 * expansion, `[a-z]` classes, `!` negation and `()` groups are all glob syntax a
 * ban list has to have thought of; an allowlist does not.
 *
 * A leading `.` is fine (`.generated`), while BEING one is not: `.` and `..`
 * name a position rather than a directory.
 */
export function isSafeDirectorySegment(segment: string): boolean {
  if (segment === "." || segment === "..") return false;
  return /^[A-Za-z0-9._-]+$/.test(segment);
}

/**
 * True when the style tier has a subject at this position and in this module.
 *
 * The whole question the three style rules and `style/token-equality` ask before
 * they read a line: a position that carries no presentation has no styling to
 * get wrong, and the token SOURCE has to write the literals every other file is
 * told to name instead.
 *
 * Both halves live here because both are one question asked by four rules, and
 * each half had drifted while it was spelled privately. Taking a PATH rather
 * than a role is what keeps the structural check on this owner too — it has no
 * role to hand in.
 *
 * NEGATIVE SPACE: this asks about position and module only. Whether the file is
 * in a declared tree at all, and whether it is architecture-exempt, are answered
 * before this is called — a caller that skips those checks gets a style verdict
 * on a script.
 */
export function isStyleSubject(vocabulary: TreeVocabulary, pathFromSourceRoot: string): boolean {
  const place = classifySourcePath(vocabulary, pathFromSourceRoot);
  if (place !== undefined && !carriesPresentation(place.profile)) return false;
  return withoutSourceExtension(pathFromSourceRoot) !== themeModule(vocabulary);
}

/**
 * The positions that run on the SERVER, as the one answer three rules used to
 * hold a copy of each.
 *
 * `features/billing/legacy-service/` is still a client context — a directory that
 * merely ends in a server layer's name is not that layer — and a tree that
 * renames a layer keeps the same answer, because this reads a profile and not a
 * directory.
 *
 * NEGATIVE SPACE: position only. The other half of "does this run on the server"
 * is the module SUFFIX, which is a name in the tree's vocabulary rather than a
 * position — `isServerModule` answers that half, and a caller asking the whole
 * question asks both.
 */
export function runsOnServer(profile: SourceProfile): boolean {
  return (
    profile === "infrastructure" ||
    profile === "feature-controllers" ||
    profile === "feature-repo" ||
    profile === "feature-service"
  );
}

/**
 * True when a path names a server-only MODULE by its suffix, in the tree's own
 * spelling: `charge.server.ts`, and `charge.server.mts` too.
 *
 * Compared after the extension is stripped rather than by a regex that lists
 * extensions, so this covers every extension `SOURCE_EXTENSIONS` does. The three
 * private regexes it replaces listed four of the eight.
 */
export function isServerModule(vocabulary: TreeVocabulary, pathFromSourceRoot: string): boolean {
  return withoutSourceExtension(pathFromSourceRoot).endsWith(vocabulary.serverModuleSuffix);
}

/**
 * Where an import LANDS. Coarser than a profile on purpose: policy is stated
 * against an area, and the exposure a row grants (`barrel`, a module allowlist)
 * is what narrows it to a path. `package` is a real area with its own column, not
 * an absence — a bare specifier has no relative spelling, which is why the oxlint
 * tier owns package policy outright.
 *
 * Two areas have no matching profile and that asymmetry is deliberate. `env-server`
 * and `env-client` are DESTINATIONS with different exposure; as sources they are
 * two files in the source root with one row between them, because what an env
 * module may import is the same question for both.
 */
export type TargetArea =
  | "route"
  | "feature"
  | "domain"
  | "infrastructure"
  | "shared"
  | "shared-ui"
  | "env-server"
  | "env-client"
  | "source-root"
  | "package";

/**
 * A file's position, and the unit it belongs to.
 *
 * `unit` is what makes "same-unit edges never reach the policy table" decidable.
 * It is deliberately NOT the boundary the import graph computes: `shared/ui` and
 * `shared` are one boundary and two units, which is exactly the hole this
 * distinction closes — `import { theme } from "../lib/tokens"` inside
 * `src/shared/ui/` is a real crossing that a boundary comparison cannot see.
 */
export type SourcePlace = { profile: SourceProfile; unit: string };

/** Where a specifier lands: its area, the unit it is inside, and the path itself. */
export type TargetPlace = { area: TargetArea; unit: string; path: string };

/**
 * The unit every file sitting directly in the source root belongs to. A single
 * unit rather than one per file, so `client.tsx` importing `./router` is internal
 * — which it is: they compose the app, they do not cross anything.
 */
export const SOURCE_ROOT_UNIT = ".";

/** The two barrels a unit's public surface may be spelled as, without extensions. */
/**
 * The composite paths, each derived from the atomic segments above.
 *
 * Functions rather than stored fields, and that is the whole point: a stored
 * `dbDir: "infrastructure/db"` beside an `infrastructureDir: "infrastructure"`
 * is one fact written twice, and renaming the parent leaves the composite
 * pointing at a directory that no longer exists — silently, because the rule
 * reading the composite and the rule reading the parent both still match
 * something. Every one of these was a stored field, and each pair could drift.
 */
export function sharedUiDir(vocabulary: TreeVocabulary): string {
  return `${vocabulary.sharedDir}/${vocabulary.sharedUiSubdir}`;
}

export function dbDir(vocabulary: TreeVocabulary): string {
  return `${vocabulary.infrastructureDir}/${vocabulary.dbSubdir}`;
}

export function dbSchemaPath(vocabulary: TreeVocabulary): string {
  return `${dbDir(vocabulary)}/${vocabulary.dbSchemaSubdir}`;
}

export function apiClientModule(vocabulary: TreeVocabulary): string {
  return `${vocabulary.infrastructureDir}/${vocabulary.apiClientName}`;
}

export function browserStorageModule(vocabulary: TreeVocabulary): string {
  return `${vocabulary.infrastructureDir}/${vocabulary.browserStorageName}`;
}

export function themeModule(vocabulary: TreeVocabulary): string {
  return `${sharedUiDir(vocabulary)}/${vocabulary.themeModuleName}`;
}

export function rootRouteModule(vocabulary: TreeVocabulary): string {
  return `${vocabulary.routesDir}/${vocabulary.rootRouteName}`;
}

/**
 * Every module permitted at a feature's root, without extensions: its two
 * barrels plus this tree's spelling of each `FEATURE_ROOT_ROLES` position.
 */
export function featureRootModules(vocabulary: TreeVocabulary): string[] {
  // Read through the ROLE set, not `Object.values`. The record's type refuses an
  // extra key in a literal, but a value that arrived as a `Record<string, string>`
  // carries whatever it carries — and `Object.values` would permit those names at
  // every feature root, which is exactly the appendable list this replaced.
  return [
    ...barrelModules(vocabulary),
    ...FEATURE_ROOT_ROLES.map((role) => vocabulary.featureRootPositions[role]),
  ];
}

/**
 * Every module permitted directly in the source root, without extensions: the
 * env modules and token stylesheet the tree declares, plus its spelling of each
 * `SOURCE_ROOT_ROLES` position.
 */
export function sourceRootModules(vocabulary: TreeVocabulary): string[] {
  return [
    ...Object.keys(vocabulary.envModules),
    // Through the role set for the same reason as `featureRootModules`.
    ...SOURCE_ROOT_ROLES.map((role) => vocabulary.sourceRootPositions[role]),
    vocabulary.tokenStylesheetName,
  ];
}

/** Every stylesheet in a tree, in one walk: `**\/*.{css,…}`. */
export function stylesheetGlob(vocabulary: TreeVocabulary): string {
  return `**/${extensionGlob(vocabulary.stylesheetExtensions)}`;
}

export function barrelModules(vocabulary: TreeVocabulary): string[] {
  return [vocabulary.clientBarrelModule, vocabulary.serverBarrelModule];
}

/**
 * The feature layer directories, highest to lowest. Derived from the shared role
 * ORDER and this tree's spellings, so the two cannot disagree — which is what a
 * separate `layerOrder` list allowed.
 */
export function orderedLayerDirs(vocabulary: TreeVocabulary): string[] {
  return FEATURE_LAYER_ROLES.map((role) => vocabulary.featureLayerDirs[role]);
}

/** The role a directory name inside a feature plays, or undefined when it is not a layer. */
export function featureLayerRole(
  vocabulary: TreeVocabulary,
  directoryName: string,
): FeatureLayerRole | undefined {
  return FEATURE_LAYER_ROLES.find(
    (role) => vocabulary.featureLayerDirs[role] === directoryName,
  );
}

/**
 * The top-level directories whose CHILDREN are the boundary rather than
 * themselves — `features/billing` is a boundary, `features` is not.
 *
 * Derived rather than declared. It used to be its own config list, which meant a
 * project could subdivide a directory the classifiers knew nothing about: the
 * structural graph would rank and grant inside it while every oxlint rule read
 * it as one undivided position.
 */
export function subdividedDirs(vocabulary: TreeVocabulary): string[] {
  return [vocabulary.featuresDir, vocabulary.domainsDir];
}

/**
 * The closed set of first path segments under a source root.
 *
 * The values of `topLevelDirsByField`, never a second listing of the same five
 * fields: the validator needs the field NAMES to say which two collided, and
 * every other caller needs only the names — two lists would let a sixth
 * position be added to one and validated by neither.
 */
export function topLevelDirs(vocabulary: TreeVocabulary): string[] {
  return Object.values(topLevelDirsByField(vocabulary));
}
// ORDERING DEPENDENCY, and it is not extractable: adding a sixth top-level
// directory means adding it BOTH here and as an arm in `classifySourcePath`
// below. The two cannot be one list — this one answers "may a directory sit
// here", while each arm there decides what the directory's INSIDE means, and
// `features/` has layers where `domains/` does not.
//
// Adding it to one only is silent and reads as working: with just this list,
// `placement/topology` permits the directory while `classifySourcePath` returns
// undefined for everything in it, so `boundary/import-policy` reports every file
// under it as an unclassified source. With just the arm, topology reports the
// directory itself. Either way the run is loud in the WRONG place.

/** The path with a source extension removed, so `env.server.ts` and `env.server` compare equal. */
export function withoutSourceExtension(path: string): string {
  for (const extension of SOURCE_EXTENSIONS) {
    if (path.endsWith(`.${extension}`)) return path.slice(0, -(extension.length + 1));
  }
  return path;
}

export function isAssetSpecifier(vocabulary: TreeVocabulary, specifier: string): boolean {
  // The query string is part of the spelling (`../styles.css?url`) and not part
  // of the extension.
  const path = specifier.split("?")[0] ?? specifier;
  return vocabulary.assetExtensions.some((extension) => path.endsWith(`.${extension}`));
}

/**
 * `.` and `..` segments folded away, or undefined when the path climbs out of the source root.
 *
 * This is not tidiness. `@/domains/billing/../../infrastructure/db/client` compiles, resolves to
 * `infrastructure/db/client`, and — unfolded — classifies on its first two segments as the unit
 * `domains/billing`, which is the IMPORTING file's own unit. The evaluator then returns `internal`
 * before the table is consulted, so a domain takes a runtime dependency on the database and no row
 * of the policy is ever read. Every profile is bypassable the same way, and the structural tier
 * cannot rescue it because it skips every non-relative edge.
 *
 * The resolved graph already normalises, via `path.resolve`. Folding here is what makes the two
 * tiers agree about what a specifier MEANS, which is the contract the whole engine rests on —
 * without it, `@/x/../y` is one edge with two verdicts.
 *
 * Undefined rather than a clamped path when it escapes: `@/../vite.config` names something outside
 * the application, and answering with a plausible path in range is how a fail-closed rule fails
 * open.
 */
export function normalizeSourcePath(path: string): string | undefined {
  const folded: string[] = [];
  for (const segment of path.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment !== "..") {
      folded.push(segment);
      continue;
    }
    if (folded.length === 0) return undefined;
    folded.pop();
  }
  return folded.join("/");
}

/** The canonical alias spelling of a path from this tree's source root. */
export function aliasSpecifierFor(vocabulary: TreeVocabulary, pathFromSourceRoot: string): string {
  return `${vocabulary.aliasPrefix}${pathFromSourceRoot}`;
}

/**
 * What a specifier names, for the tier that reads specifiers rather than a
 * resolved graph.
 *
 * `undefined` means "not this tier's question", and it covers two unrelated
 * cases on purpose: an asset, and a RELATIVE path — which oxlint cannot resolve
 * at all and which the structural adapter owns completely. The two tiers need no
 * agreement about that split because it follows from the data: a package has no
 * relative spelling, and a relative path has no meaning without the tree.
 *
 * NEGATIVE SPACE, and it is the last arm: anything that is neither relative nor
 * under this tree's alias prefix is a PACKAGE. That includes a SECOND alias root
 * — `@assets/logo`, `@core/money` — which is the right answer rather than a
 * missing case: an alias that resolves outside this tree names something this
 * tree imports and does not contain, which is what a package is, and the package
 * rows of the policy table are the ones that should govern it.
 *
 * There is deliberately no list of "aliases that point outside". A prefix list
 * cannot tell an alias from a package name — `["effect", "@tanstack/"]` is a
 * well-formed one — so every entry is a package whose import policy the adopter
 * has switched off, in a field that reads like a path mapping.
 */
export function classifySpecifier(
  vocabulary: TreeVocabulary,
  specifier: string,
): { kind: "module"; path: string } | { kind: "package"; name: string } | undefined {
  if (isAssetSpecifier(vocabulary, specifier)) return undefined;
  if (specifier.startsWith(".") || specifier.startsWith("/")) return undefined;
  if (specifier.startsWith(vocabulary.aliasPrefix)) {
    const path = normalizeSourcePath(specifier.slice(vocabulary.aliasPrefix.length));
    // A path that climbed out of the source root is not an application module. Undefined here
    // means "not this tier's question", which is right: there is no area to police.
    return path === undefined || path === "" ? undefined : { kind: "module", path };
  }
  return { kind: "package", name: packageNameOf(specifier) };
}

/**
 * The package a bare specifier belongs to. A scoped package keeps both segments
 * (`@tanstack/react-query`); everything else keeps one, so a subpath import
 * (`drizzle-orm/pg-core`) is the same package as the bare one and cannot be used
 * to step around a policy keyed on the name.
 */
export function packageNameOf(specifier: string): string {
  const segments = specifier.split("/");
  if (specifier.startsWith("@")) return segments.slice(0, 2).join("/");
  return segments[0] ?? specifier;
}

/** True when `path` names `unit`'s public surface — the bare unit, or one of its barrels. */
export function isUnitBarrel(
  vocabulary: TreeVocabulary,
  unit: string,
  path: string,
): boolean {
  const bare = withoutSourceExtension(path);
  if (bare === unit) return true;
  return barrelModules(vocabulary).some((barrel) => bare === `${unit}/${barrel}`);
}

/** True when `path` is `prefix` or sits under it, compared on whole segments. */
export function isUnderPath(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

/**
 * Where a file sits, or undefined when nothing under the source root claims it.
 *
 * Undefined is the loud case and never a silent skip. With five rules the covered
 * set was whatever the union of their path regexes happened to be, and a hole was
 * invisible; here an unclaimed file is a diagnostic that names itself.
 */
export function classifySourcePath(
  vocabulary: TreeVocabulary,
  pathFromSourceRoot: string,
): SourcePlace | undefined {
  if (hasTraversalSegment(pathFromSourceRoot)) return undefined;
  const path = withoutSourceExtension(pathFromSourceRoot);
  const segments = path.split("/");
  const [top, second, third] = segments;

  if (top === undefined || top === "") return undefined;

  // A file sitting directly in the source root: the env modules, the router, the
  // client and server entrypoints, the generated route tree. They compose the
  // app rather than living in a layer of it, which is why they are one profile
  // and one unit — `placement/topology` is what decides WHICH files may sit here.
  if (second === undefined) return { profile: "source-root", unit: SOURCE_ROOT_UNIT };

  if (top === vocabulary.routesDir) return { profile: "route", unit: vocabulary.routesDir };

  if (top === vocabulary.featuresDir) {
    const unit = `${vocabulary.featuresDir}/${second}`;
    // A feature's LAYERS are profiles and its root is not, so without these two
    // arms `features/billing/index.ts` matches no layer and is unclassified on
    // day one. Domains need no equivalent — every file under `domains/<name>/`
    // is the same profile, barrel included.
    //
    // The two root profiles are split because a barrel's licence is genuinely
    // narrower than any other root file's: a barrel announces the feature and
    // may name nothing outside it, while `errors.ts` — the one other root file
    // `directory-model.md` names — is ordinary feature code that happens to sit
    // above the layers. Keyed on the barrel names rather than on the tree's list
    // of permitted root files, so this does NOT have to agree with
    // `placement/topology`: that check decides which root files may EXIST, and a
    // root file it rejects still gets an import policy here rather than falling
    // through to "unclassified" and being reported twice for one mistake.
    if (third !== undefined && segments.length === 3) {
      return {
        profile: barrelModules(vocabulary).includes(third) ? "feature-barrel" : "feature-root",
        unit,
      };
    }
    if (third !== undefined && segments.length > 3) {
      const role = featureLayerRole(vocabulary, third);
      if (role !== undefined) return { profile: `feature-${role}`, unit };
    }
    // A directory inside a feature that is not a layer. `placement/topology`
    // rejects it; here it is a position with no import policy, which is the loud
    // case — the covered set must not silently grow a hole shaped like a
    // directory somebody invented.
    return undefined;
  }

  if (top === vocabulary.domainsDir) {
    return { profile: "domain", unit: `${vocabulary.domainsDir}/${second}` };
  }
  if (top === vocabulary.infrastructureDir) {
    return { profile: "infrastructure", unit: vocabulary.infrastructureDir };
  }
  if (top === vocabulary.sharedDir) {
    return isUnderPath(path, sharedUiDir(vocabulary))
      ? { profile: "shared-ui", unit: sharedUiDir(vocabulary) }
      : { profile: "shared", unit: vocabulary.sharedDir };
  }

  return undefined;
}

/** Where a path from this tree's source root lands, or undefined when it names no area. */
export function classifyTargetPath(
  vocabulary: TreeVocabulary,
  pathFromSourceRoot: string,
): TargetPlace | undefined {
  if (hasTraversalSegment(pathFromSourceRoot)) return undefined;
  const path = withoutSourceExtension(pathFromSourceRoot);
  const [top, second] = path.split("/");
  if (top === undefined || top === "") return undefined;

  // A bare `@/shared` or `@/infrastructure` names that unit's barrel. Requiring a second segment
  // would answer "no known area" for an area that is right there in this file — and, worse, answer
  // it differently from `@/shared/`, which folds to the same path. `features` and `domains` are
  // deliberately absent: they are subdivided, so the bare directory names no unit at all.
  if (second === undefined) {
    const env = vocabulary.envModules[path];
    // The env modules carry their own AREA, because what may reach server env is
    // the question two columns of the table exist to answer — and the source-root
    // UNIT, because they sit in the source root and `src/router.tsx` importing
    // `./env.client` is two files in one unit composing the app. Splitting the
    // unit off the area here reported that sibling import as a hidden crossing
    // and told the author to write `@/env.client`, which is the same edge.
    if (env !== undefined) return { area: env, unit: SOURCE_ROOT_UNIT, path };
    if (top === vocabulary.routesDir) return { area: "route", unit: vocabulary.routesDir, path };
    if (top === vocabulary.infrastructureDir) {
      return { area: "infrastructure", unit: vocabulary.infrastructureDir, path };
    }
    if (top === vocabulary.sharedDir) {
      return { area: "shared", unit: vocabulary.sharedDir, path };
    }
    // A DECLARED source-root file, and nothing else. One segment cannot be read
    // as "a file, therefore the source root": `src/lib.ts` and `src/lib/` are one
    // string here, so falling through would hand `@/lib` the source-root row and
    // leave an unpoliced directory reachable by its bare name from anywhere.
    if (sourceRootModules(vocabulary).some((file) => withoutSourceExtension(file) === path)) {
      return { area: "source-root", unit: SOURCE_ROOT_UNIT, path };
    }
    return undefined;
  }

  if (top === vocabulary.routesDir) return { area: "route", unit: vocabulary.routesDir, path };
  if (top === vocabulary.featuresDir) {
    return { area: "feature", unit: `${vocabulary.featuresDir}/${second}`, path };
  }
  if (top === vocabulary.domainsDir) {
    return { area: "domain", unit: `${vocabulary.domainsDir}/${second}`, path };
  }
  if (top === vocabulary.infrastructureDir) {
    return { area: "infrastructure", unit: vocabulary.infrastructureDir, path };
  }
  if (top === vocabulary.sharedDir) {
    return isUnderPath(path, sharedUiDir(vocabulary))
      ? { area: "shared-ui", unit: sharedUiDir(vocabulary), path }
      : { area: "shared", unit: vocabulary.sharedDir, path };
  }

  return undefined;
}

/**
 * A normalised path never contains one, so this costs nothing legitimate — and it is what keeps a
 * caller that forgot to normalise from getting a confident wrong answer instead of a loud one.
 * Both entry points fold before they classify; this is the floor under them, not the mechanism.
 */
function hasTraversalSegment(path: string): boolean {
  return path.split("/").some((segment) => segment === "." || segment === "..");
}
