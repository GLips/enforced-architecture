// ─── policy/layout — where a file sits, and where a specifier lands ──────────
//
// The vocabulary both enforcement tiers share. It is deliberately BELOW them: no
// Bun APIs, no Node APIs, no oxlint ESTree types, no import from `../structural/`
// or `../oxlint/`. Plain strings, records, discriminated unions, pure functions.
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
// Everything here speaks ONE currency: a path from the source root, with no
// leading slash and no extension needed — `features/billing/repo/invoice-rows`.
// That is what makes the two callers interchangeable. The resolved import graph
// produces it by resolving a relative specifier and taking `relative(root, …)`;
// an alias specifier becomes the identical string by slicing `@/`. One
// classifier, one evaluator, two ways of obtaining its input.
//
// ── Adapt ────────────────────────────────────────────────────────────────────
//
// Renaming a top-level directory, adding a feature layer, or moving the root
// layout is a change HERE and nowhere else. The policy table in
// `import-policy.ts` is keyed by the profiles below, so adding one is a compile
// error until every cell of its row is filled in — which is the property the
// five per-rule path regexes this replaces could not offer.
//
// The constants below are the recommended layout of `directory-model.md`. A
// project that calls `domains/` `core/`, or routes its pages from `app/` rather
// than `routes/`, edits the constant and nothing else: every classifier, every
// row of the table, and the structural tier's `arch.config.ts` read them.
//
// ─────────────────────────────────────────────────────────────────────────────

/** How the source root is spelled on disk and in a path from the project root. */
export const SOURCE_ROOT = "src";

/** How the source root is spelled in a module specifier. */
export const ALIAS_PREFIX = "@/";

export const ROUTES_DIR = "routes";
export const FEATURES_DIR = "features";
export const DOMAINS_DIR = "domains";
export const INFRASTRUCTURE_DIR = "infrastructure";
export const SHARED_DIR = "shared";
export const SHARED_UI_DIR = "shared/ui";

/**
 * The database module inside `infrastructure/`, and the schema directory within
 * it. Two rules read these: `boundary/db-isolation` builds its specifier test
 * from `DB_DIR`, and `boundary/layer-occupancy` gates a schema import from any
 * layer above the lowest one on `DB_SCHEMA_PATH`. A project with a flat `@/db`
 * moves it here once instead of editing a regex in one rule and a config key in
 * another, which is how the two end up fencing different paths while both report
 * clean.
 */
export const DB_DIR = `${INFRASTRUCTURE_DIR}/db`;
export const DB_SCHEMA_PATH = `${DB_DIR}/schema`;

/**
 * Intra-feature layers, highest to lowest. `placement/layer-direction` reads the
 * ORDER to judge direction; this module only reads membership, because a layer's
 * rank is a question about two ends of one feature and never reaches the policy
 * table.
 */
export const FEATURE_LAYERS = ["ui", "controllers", "service", "repo"] as const;
export type FeatureLayer = (typeof FEATURE_LAYERS)[number];

// Named singly as well as ordered, because several checks are about ONE layer by
// ROLE rather than about the order — where a server function may live, which
// layer a trampoline is a smell in. Those read the name.
//
// `placement/layer-direction` and `boundary/layer-occupancy` read the POSITION
// instead and name no layer at all — occupancy finds the data layer as the LAST
// entry of the array rather than as `REPO_LAYER`, so a project renaming a layer
// edits `FEATURE_LAYERS` and neither rule notices. That leaves `SERVICE_LAYER`
// as the only one of the four with a consumer today; the other three are the
// vocabulary a project's own config reaches for, not dead constants.
//
// A check restating "service" as a literal is a check a project silently breaks
// when it renames the layer, and the break is a rule that stops matching rather
// than one that errors.
//
// The annotations run INVERSE to the array on purpose. Each constant is declared
// as a `FeatureLayer` and assigned a literal, so dropping a layer out of
// `FEATURE_LAYERS` above makes the matching constant here a type error rather
// than an exported string pointing at a directory that is no longer a layer —
// which would leave the rule reading it quietly matching nothing, the failure
// `boundary/layer-occupancy.md` already documents from the other side. That is a
// promise only a typechecker can keep, so `bun run typecheck` compiles this file
// under both tiers' tsconfigs — otherwise the inversion is prose.
export const UI_LAYER: FeatureLayer = "ui";
export const CONTROLLERS_LAYER: FeatureLayer = "controllers";
export const SERVICE_LAYER: FeatureLayer = "service";
export const REPO_LAYER: FeatureLayer = "repo";

/**
 * The barrel filenames a unit's public surface may be spelled as, without the
 * extension. `index.server` is here because it is a SECOND public barrel and not
 * a deep import: `directory-model.md` gives every feature and every domain a
 * client-safe `index.ts` and an optional server-only `index.server.ts`, and both
 * are the unit announcing itself.
 *
 * WHICH of the two a given caller may name is a different question — a client
 * context importing a unit's `index.server` is `api/server-import-context`'s finding,
 * and a client barrel importing its own server barrel is `api/barrel-direction`'s.
 * Both survive this merge. This list is only about what counts as the surface.
 */
export const BARREL_MODULES = ["index", "index.server"];

/**
 * Env modules, and which exposure each one carries. The split is not cosmetic:
 * `directory-model.md`'s recommended setup puts secrets in `env.server.ts` and
 * `VITE_PUBLIC_*` in `env.client.ts`, and `import-boundaries.md` answers the two
 * columns differently in six of ten rows — a route may read the client env and
 * may not read the server one.
 *
 * A project on the SINGLE-env option (one `env.ts`) maps that file here. It is
 * listed as `env-server` because a combined module still carries the secrets,
 * and a combined module read from a client context is the leak the split exists
 * to prevent.
 */
export const ENV_MODULES: Record<string, "env-server" | "env-client"> = {
  "env.server": "env-server",
  "env.client": "env-client",
  env: "env-server",
};

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
 * `placement/topology` reads this same list as its `allowedRootFiles`, so a
 * project adding an entrypoint declares it once. A project that adopted only the
 * oxlint tier has no topology check at all, which is the other half of the
 * argument for the list living here rather than in that rule's config.
 */
export const SOURCE_ROOT_FILES = [
  ...Object.keys(ENV_MODULES).map((module) => `${module}.ts`),
  "router.tsx",
  "client.tsx",
  "server.ts",
  "styles.css",
  "routeTree.gen.ts",
];

/**
 * Aliases that resolve OUTSIDE the source root. A tsconfig path mapping onto a
 * sibling directory — `@/assets/*` onto the repo's `assets/` — is not an
 * unpoliced area, it is not an application module at all. Without this, the
 * fail-closed reading of an unknown `@/…` prefix reports every font and image as
 * a new top-level directory.
 *
 * Empty in the standard layout, which maps only `@/` onto `src/`. Add the prefix
 * WITH its trailing slash when the project maps a second one.
 */
export const NON_SOURCE_ALIASES: string[] = [];

/**
 * Specifier suffixes that resolve inside the source root but are not module
 * edges. Load-bearing rather than defensive: a stylesheet or an image imported
 * for its URL otherwise surfaces as a crossing with a filename where an area
 * name should be.
 */
export const ASSET_EXTENSIONS = [
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
];

const SOURCE_EXTENSIONS = ["ts", "tsx", "mts", "cts", "js", "jsx", "mjs", "cjs"];

/**
 * Every position a file can occupy. Exhaustive by construction: the policy table
 * is keyed by this union, so a new profile is a compile error until its whole row
 * is decided. A file under a production root that matches none of these is
 * UNCLASSIFIED, which is the loud case — a new top-level directory must not enter
 * the app as an area nothing polices.
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

/** The path with a source extension removed, so `env.server.ts` and `env.server` compare equal. */
export function withoutSourceExtension(path: string): string {
  for (const extension of SOURCE_EXTENSIONS) {
    if (path.endsWith(`.${extension}`)) return path.slice(0, -(extension.length + 1));
  }
  return path;
}

export function isAssetSpecifier(specifier: string): boolean {
  // The query string is part of the spelling (`../styles.css?url`) and not part
  // of the extension.
  const path = specifier.split("?")[0] ?? specifier;
  return ASSET_EXTENSIONS.some((extension) => path.endsWith(`.${extension}`));
}

/**
 * A file's path from the source root, or undefined when it is not under one.
 *
 * The oxlint tier is handed an ABSOLUTE filename and has no project root to
 * measure against, so the source root is found by its own segment. The LAST
 * occurrence wins: a checkout living under a directory called `src` is far more
 * likely than an application directory called `src` nested inside `src/`.
 */
export function sourcePathFromFilename(absolutePath: string): string | undefined {
  const marker = `/${SOURCE_ROOT}/`;
  const at = absolutePath.lastIndexOf(marker);
  return at === -1 ? undefined : absolutePath.slice(at + marker.length);
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

/** The canonical alias spelling of a source-root-relative path. */
export function aliasSpecifierFor(pathFromSourceRoot: string): string {
  return `${ALIAS_PREFIX}${pathFromSourceRoot}`;
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
  specifier: string,
): { kind: "module"; path: string } | { kind: "package"; name: string } | undefined {
  if (isAssetSpecifier(specifier)) return undefined;
  if (specifier.startsWith(".") || specifier.startsWith("/")) return undefined;
  if (NON_SOURCE_ALIASES.some((prefix) => specifier.startsWith(prefix))) return undefined;
  if (specifier.startsWith(ALIAS_PREFIX)) {
    const path = normalizeSourcePath(specifier.slice(ALIAS_PREFIX.length));
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
export function isUnitBarrel(unit: string, path: string): boolean {
  const bare = withoutSourceExtension(path);
  if (bare === unit) return true;
  return BARREL_MODULES.some((barrel) => bare === `${unit}/${barrel}`);
}

/**
 * Where a file sits, or undefined when nothing under the source root claims it.
 *
 * Undefined is the loud case and never a silent skip. With five rules the covered
 * set was whatever the union of their path regexes happened to be, and a hole was
 * invisible; here an unclaimed file is a diagnostic that names itself.
 */
export function classifySourcePath(pathFromSourceRoot: string): SourcePlace | undefined {
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

  if (top === ROUTES_DIR) return { profile: "route", unit: ROUTES_DIR };

  if (top === FEATURES_DIR) {
    const unit = `${FEATURES_DIR}/${second}`;
    // A feature's LAYERS are profiles and its root is not, so without these two
    // arms `features/billing/index.ts` matches no layer and is unclassified on
    // day one. Domains need no equivalent — every file under `domains/<name>/`
    // is the same profile, barrel included.
    //
    // The two root profiles are split because a barrel's licence is genuinely
    // narrower than any other root file's: a barrel announces the feature and
    // may name nothing outside it, while `errors.ts` — the one other root file
    // `directory-model.md` names — is ordinary feature code that happens to sit
    // above the layers. Keyed on the barrel names rather than on a list of
    // permitted root files, so this does NOT have to agree with
    // `placement/topology`'s `rootFiles`: that check decides which root files may
    // EXIST, and a root file it rejects still gets an import policy here rather
    // than falling through to "unclassified" and being reported twice for one
    // mistake.
    if (third !== undefined && segments.length === 3) {
      return {
        profile: BARREL_MODULES.includes(third) ? "feature-barrel" : "feature-root",
        unit,
      };
    }
    if (third !== undefined && segments.length > 3 && isFeatureLayer(third)) {
      return { profile: `feature-${third}`, unit };
    }
    // A directory inside a feature that is not a layer. `placement/topology`
    // rejects it; here it is a position with no import policy, which is the loud
    // case — the covered set must not silently grow a hole shaped like a
    // directory somebody invented.
    return undefined;
  }

  if (top === DOMAINS_DIR) return { profile: "domain", unit: `${DOMAINS_DIR}/${second}` };
  if (top === INFRASTRUCTURE_DIR) {
    return { profile: "infrastructure", unit: INFRASTRUCTURE_DIR };
  }
  if (top === SHARED_DIR) {
    return second === "ui"
      ? { profile: "shared-ui", unit: SHARED_UI_DIR }
      : { profile: "shared", unit: SHARED_DIR };
  }

  return undefined;
}

/** Where a source-root-relative specifier lands, or undefined when it names no area. */
export function classifyTargetPath(pathFromSourceRoot: string): TargetPlace | undefined {
  if (hasTraversalSegment(pathFromSourceRoot)) return undefined;
  const path = withoutSourceExtension(pathFromSourceRoot);
  const [top, second] = path.split("/");
  if (top === undefined || top === "") return undefined;

  // A bare `@/shared` or `@/infrastructure` names that unit's barrel. Requiring a second segment
  // would answer "no known area" for an area that is right there in this file — and, worse, answer
  // it differently from `@/shared/`, which folds to the same path. `features` and `domains` are
  // deliberately absent: they are subdivided, so the bare directory names no unit at all.
  if (second === undefined) {
    const env = ENV_MODULES[path];
    // The env modules carry their own AREA, because what may reach server env is
    // the question two columns of the table exist to answer — and the source-root
    // UNIT, because they sit in the source root and `src/router.tsx` importing
    // `./env.client` is two files in one unit composing the app. Splitting the
    // unit off the area here reported that sibling import as a hidden crossing
    // and told the author to write `@/env.client`, which is the same edge.
    if (env !== undefined) return { area: env, unit: SOURCE_ROOT_UNIT, path };
    if (top === ROUTES_DIR) return { area: "route", unit: ROUTES_DIR, path };
    if (top === INFRASTRUCTURE_DIR) {
      return { area: "infrastructure", unit: INFRASTRUCTURE_DIR, path };
    }
    if (top === SHARED_DIR) return { area: "shared", unit: SHARED_DIR, path };
    // A DECLARED source-root file, and nothing else. One segment cannot be read
    // as "a file, therefore the source root": `src/lib.ts` and `src/lib/` are one
    // string here, so falling through would hand `@/lib` the source-root row and
    // leave an unpoliced directory reachable by its bare name from anywhere.
    if (SOURCE_ROOT_FILES.some((file) => withoutSourceExtension(file) === path)) {
      return { area: "source-root", unit: SOURCE_ROOT_UNIT, path };
    }
    return undefined;
  }

  if (top === ROUTES_DIR) return { area: "route", unit: ROUTES_DIR, path };
  if (top === FEATURES_DIR) {
    return { area: "feature", unit: `${FEATURES_DIR}/${second}`, path };
  }
  if (top === DOMAINS_DIR) {
    return { area: "domain", unit: `${DOMAINS_DIR}/${second}`, path };
  }
  if (top === INFRASTRUCTURE_DIR) {
    return { area: "infrastructure", unit: INFRASTRUCTURE_DIR, path };
  }
  if (top === SHARED_DIR) {
    return second === "ui"
      ? { area: "shared-ui", unit: SHARED_UI_DIR, path }
      : { area: "shared", unit: SHARED_DIR, path };
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

function isFeatureLayer(segment: string): segment is FeatureLayer {
  return (FEATURE_LAYERS as readonly string[]).includes(segment);
}
