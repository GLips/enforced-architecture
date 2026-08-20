// ─── policy/layout — what a tree is called, and where a file sits in one ─────
//
// The vocabulary both enforcement tiers share, as a VALUE rather than as a set
// of module constants. One `TreeVocabulary` describes one declared tree: how its
// directories are spelled, how deep its feature layers go, which files may sit
// at its root. `policy/declared-trees.ts` is the list of trees a project has
// adopted, and every classifier here takes the vocabulary of the tree the file
// was resolved into.
//
// It is deliberately BELOW both tiers: no Bun APIs, no Node APIs, no oxlint
// ESTree types, no import from `../structural/` or `../oxlint/`. Plain strings,
// records, discriminated unions, pure functions.
//
// That constraint is a CONVENTION, and nothing enforces it. Both tooling
// tsconfigs include this directory, so it typechecks twice — once under
// `types: ["bun"]` and once under `types: ["node"]` — but a `node:` builtin
// resolves under both, so `import { resolve } from "node:path"` here compiles
// clean. The dual typecheck catches a Bun global or a Node global, and nothing
// else — a `node:` import or a reach into `../oxlint/` is caught by review or by
// nothing. Make the rule mechanical the first time either of those lands in a
// diff, rather than trusting this paragraph a second time.
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
// Those two used to be one `layerOrder: string[]`, and the conflation is why a
// project could repoint the structural tier's layers without the oxlint tier's
// profiles noticing.
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
   * The shared primitives, as a path from the source root. A full path rather
   * than a child name, because `shared/ui` is one unit with one spelling and
   * every rule that names it wants the whole thing.
   */
  sharedUiDir: string;

  /**
   * The directory each feature position is spelled as. Keyed by role, so a
   * rename cannot leave a rule matching a directory that no longer exists — the
   * key stays, the value moves, and `orderedLayerDirs` follows.
   */
  featureLayerDirs: Record<FeatureLayerRole, string>;

  /**
   * Files permitted directly at a feature's root, with extensions.
   * `placement/topology` reads this; `classifySourcePath` deliberately does not
   * — see its `feature-root` arm for why a root file this list rejects still
   * gets an import policy.
   */
  featureRootFiles: string[];

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
   * Env modules, and which exposure each one carries. The split is not cosmetic:
   * `directory-model.md`'s recommended setup puts secrets in `env.server.ts` and
   * `VITE_PUBLIC_*` in `env.client.ts`, and `import-boundaries.md` answers the
   * two columns differently in six of ten rows — a route may read the client env
   * and may not read the server one.
   *
   * A project on the SINGLE-env option (one `env.ts`) maps that file here. It is
   * listed as `env-server` because a combined module still carries the secrets,
   * and a combined module read from a client context is the leak the split
   * exists to prevent.
   */
  envModules: Record<string, "env-server" | "env-client">;

  /**
   * Every FILE that may sit directly in the source root, with its extension.
   *
   * This list is what stops the last arm of `classifyTargetPath` from being
   * "anything left over". One path segment is ambiguous by construction — the
   * classifier cannot tell the file `src/lib.ts` from the directory `src/lib/` —
   * so without a declared list, `@/lib` reads as a source-root file and reaches
   * `source-root`'s permissive row, while `@/lib/format-date` correctly reports
   * `unclassifiedTarget`. Add `src/lib/index.ts` and every route can reach an
   * unpoliced tree through the bare spelling, which is the exact state the
   * unclassified messages exist to make loud.
   *
   * `placement/topology` reads this same list as the files permitted at the
   * root, so a project adding an entrypoint declares it once. A project that
   * adopted only the oxlint tier has no topology check at all, which is the
   * other half of the argument for the list living in the vocabulary rather than
   * in that check's config.
   */
  sourceRootFiles: string[];

  /**
   * Aliases that resolve OUTSIDE this tree's source root. A tsconfig path
   * mapping onto a sibling directory — `@/assets/*` onto the repo's `assets/` —
   * is not an unpoliced area, it is not an application module at all. Without
   * this, the fail-closed reading of an unknown `@/…` prefix reports every font
   * and image as a new top-level directory.
   *
   * Empty in the standard layout, which maps only `@/` onto `src/`. Add the
   * prefix WITH its trailing slash when the project maps a second one.
   */
  nonSourceAliases: string[];

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
   * The database module inside `infrastructure/`, and the schema directory
   * within it. Two rules read these: `boundary/db-isolation` builds its
   * specifier test from `dbDir`, and `boundary/layer-occupancy` gates a schema
   * import from any layer above the lowest one on `dbSchemaPath`. A project with
   * a flat `@/db` moves it here once instead of editing a regex in one rule and
   * a config key in another, which is how the two end up fencing different paths
   * while both report clean.
   */
  dbDir: string;
  dbSchemaPath: string;

  /**
   * The modules that own a capability no import can fence, read by
   * `boundary/ambient-globals`: it reports `fetch` outside the API client and
   * `localStorage` outside the storage wrapper. Paths from the source root,
   * without extensions.
   *
   * Vocabulary rather than a rule-local constant because they are positions in
   * THIS tree — a project whose adapters sit in `infrastructure/` renames the
   * directory once and both entries follow.
   */
  apiClientModule: string;
  browserStorageModule: string;

  /**
   * The module holding the design tokens, and the route module that mounts the
   * app's render tree. Both are exemptions the style rules need and neither is a
   * layer: the token source DEFINES the raw values a token resolves to, and the
   * root route is where the primitives are first composed.
   */
  themeModule: string;
  rootRouteModule: string;
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
  sharedUiDir: "shared/ui",

  featureLayerDirs: {
    ui: "ui",
    controllers: "controllers",
    service: "service",
    repo: "repo",
  },

  featureRootFiles: ["index.ts", "index.server.ts", "errors.ts"],

  clientBarrelModule: "index",
  serverBarrelModule: "index.server",

  envModules: {
    "env.server": "env-server",
    "env.client": "env-client",
    env: "env-server",
  },

  sourceRootFiles: [
    "env.server.ts",
    "env.client.ts",
    "env.ts",
    "router.tsx",
    "client.tsx",
    "server.ts",
    "styles.css",
    "routeTree.gen.ts",
  ],

  nonSourceAliases: [],

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

  dbDir: "infrastructure/db",
  dbSchemaPath: "infrastructure/db/schema",

  apiClientModule: "infrastructure/api-client",
  browserStorageModule: "infrastructure/browser-storage",

  themeModule: "shared/ui/theme",
  rootRouteModule: "routes/__root",
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

/** The one glob every source walk uses. `**\/*.{ts,tsx,mts,cts,…}`. */
export const SOURCE_FILE_GLOB = `**/*.{${SOURCE_EXTENSIONS.join(",")}}`;

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

/** The closed set of first path segments under a source root. */
export function topLevelDirs(vocabulary: TreeVocabulary): string[] {
  return [
    vocabulary.routesDir,
    vocabulary.featuresDir,
    vocabulary.domainsDir,
    vocabulary.infrastructureDir,
    vocabulary.sharedDir,
  ];
}

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
 * `undefined` means "not this tier's question", and it covers three unrelated
 * cases on purpose: an asset, an alias resolving outside the source root, and a
 * RELATIVE path — which oxlint cannot resolve at all and which the structural
 * adapter owns completely. The two tiers need no agreement about that split
 * because it follows from the data: a package has no relative spelling, and a
 * relative path has no meaning without the tree.
 */
export function classifySpecifier(
  vocabulary: TreeVocabulary,
  specifier: string,
): { kind: "module"; path: string } | { kind: "package"; name: string } | undefined {
  if (isAssetSpecifier(vocabulary, specifier)) return undefined;
  if (specifier.startsWith(".") || specifier.startsWith("/")) return undefined;
  if (vocabulary.nonSourceAliases.some((prefix) => specifier.startsWith(prefix))) return undefined;
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
    return isUnderPath(path, vocabulary.sharedUiDir)
      ? { profile: "shared-ui", unit: vocabulary.sharedUiDir }
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
    if (vocabulary.sourceRootFiles.some((file) => withoutSourceExtension(file) === path)) {
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
    return isUnderPath(path, vocabulary.sharedUiDir)
      ? { area: "shared-ui", unit: vocabulary.sharedUiDir, path }
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
