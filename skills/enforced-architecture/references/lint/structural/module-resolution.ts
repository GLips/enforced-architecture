// ─── Where a specifier lands ──────────────────────────────────────────
//
// Makes sure of nothing on its own. This is the tier's ONE answer to "which
// module does this import name", consumed by `import-graph` (which compares the
// two ends of every edge as paths) and by `api/barrel-purity` (which has to open
// the next file in a chain). Do not let either of them resolve for itself: two
// answers to this question disagree about whether the answer has to exist on
// disk, and the disagreement is invisible — the check that resolves more
// loosely reports findings the other never would.
//
// The resolution is `oxc-resolver`'s — the resolver from the same project as the
// oxlint this catalog already ships. What it buys over path arithmetic is
// everything TypeScript does that a path cannot see: `./rows.js` naming
// `rows.ts`, `@/features/orders` naming that feature's barrel.
//
// ── Two answers, and the second one is why this is not just the resolver ──
//
// `createTreeModuleResolver` returns `resolved: false` with a sourcePath when
// the specifier NAMES a position inside this tree that no file on disk backs.
// That arm is load-bearing and is not a fallback in the apologetic sense:
// dropping the edge instead would mean a specifier the resolver cannot follow —
// a module declared only in a `.d.ts`, one a bundler plugin materialises, one
// whose file is mid-rename — vanishes from the graph, and every boundary rule
// reports clean over an import nobody checked. That is fail-open, in the one
// tier whose whole job is to make a silent gap impossible.
//
// So resolution SHARPENS an edge rather than deciding whether there is one. The
// single exception is an import that lands OUTSIDE this tree, which is not this
// tree's question at all — the same answer a bare package name gets.
//
// A consumer that must read the file reads `resolved`; a consumer comparing
// positions reads `sourcePath` and gets the same answer it always got when the
// disk has nothing to add. Consumers compare `sourcePath` on whole segments or
// with the extension stripped — `withoutSourceExtension` — because a resolved
// target names a MODULE (`features/orders/index.ts`) and an unresolved one names
// a POSITION (`features/orders`). Testing either spelling literally is a bug.
//
// ── NEGATIVE SPACE ────────────────────────────────────────────────────
//
// No tsconfig. `oxc-resolver` reads `paths` and this deliberately does not ask
// it to. A second path mapping known here and not to `policy/layout.ts`'s
// `classifySpecifier` gives one specifier two meanings across the two tiers,
// which is the contract the engine rests on — and `tsconfig.json` is a file the
// adopting project edits, so a rule whose scope followed it would be a rule with
// an off-switch. This tree's alias prefix is its vocabulary and is the whole of
// what is aliased. `mainFields` is emptied for the same reason and it is not
// hypothetical: with oxc's default, a `package.json` beside a feature's barrel
// redirects every DIRECTORY import of that feature — `main: "./service/x.ts"`
// makes `@/features/orders` land in a layer, and `placement/layer-direction`
// then reads the sharpest upward edge a feature can contain as an ordinary
// downward one. A rule an adopter can switch off by writing a JSON file is the
// menu re-entering through the back door. `exportsFields` is emptied beside it
// and is belt rather than braces: oxc does not consult `exports` for a directory
// request unless `allowPackageExportsInDirectoryResolve` is on, so today it
// changes nothing and the two are one decision.
//
// No node_modules, and no bare specifiers at all. A package name is not a
// boundary question this tier answers — `api/barrel-purity` reads package names
// off the scan, never off resolution — so they are refused before the resolver
// is asked, which is also why nothing here walks a node_modules tree.
//
// Symlinks are NOT followed. A symlinked feature directory keeps the name it is
// reached through, because which of its names is canonical is
// `api/feature-visibility`'s question and it resolves that itself. Following
// them here drops four fixture edges out of the source root and retargets two
// more, and takes their findings along.
//
// A BUILD-PLUGIN QUERY is dropped and the module it hangs off is resolved:
// `./template.ts?raw` resolves to `template.ts`. The edge is real — the file is
// named, and naming it across a boundary is the crossing every rule here asks
// about — but what the plugin hands back is a string rather than that module's
// exports. So `api/barrel-purity` traces into it and may over-report a chain the
// bundler would not pull in, which is that check's stated safe direction. What
// this must never do is what it did before the query was stripped: oxc appends
// the query back onto the resolved path, so `absolute` named a file that is not
// there and the first `readFile` took the whole check down.
//
// ──────────────────────────────────────────────────────────────────────

import { dirname, relative, resolve } from "node:path";
import { ResolverFactory } from "oxc-resolver";
import { isAssetSpecifier, SOURCE_EXTENSIONS, type TreeVocabulary } from "../policy/layout.ts";

/**
 * Where one specifier lands inside one declared tree.
 *
 * `sourcePath` is on both arms and means the same thing on both: the path from
 * this tree's source root that every rule compares positions with. `absolute` is
 * only on the resolved arm because it is only true there — a path to a file that
 * is not on disk is the kind of plausible answer that turns a fail-closed check
 * into a fail-open one.
 */
export type ResolvedTreeModule =
  | { resolved: true; absolute: string; sourcePath: string }
  | { resolved: false; sourcePath: string };

/** Resolves specifiers written in ONE declared tree. Hold one per tree; it caches the filesystem. */
export type TreeModuleResolver = (
  fromFile: string,
  specifier: string,
) => ResolvedTreeModule | undefined;

/**
 * The extension a TypeScript source file is SPELLED as in an import, mapped to
 * the extensions that can satisfy it.
 *
 * Under `moduleResolution: "nodenext"` an import of `./rows.ts` must be written
 * `./rows.js`, so an entire, ordinary project style resolves to nothing without
 * this. The mapping is TypeScript's own: an emitted extension is its source
 * extension with the `t` swapped for a `j`, and `.tsx` is the one source
 * extension with TWO emitted spellings — the default `jsx: "react-jsx"` emits
 * `.js` and `jsx: "preserve"` emits `.jsx`. A table that gives `.js` only `.ts`
 * is why a `nodenext` React project's first component ends a
 * `api/barrel-purity` trace in silence.
 *
 * Derived from `SOURCE_EXTENSIONS` for the reason `JSX_SOURCE_EXTENSIONS` is:
 * a hand-written pair list is how an extension the walkers read becomes one the
 * resolver cannot follow, and a hop that cannot be followed reports nothing.
 */
function extensionAliases(): Record<string, string[]> {
  const sources = new Set(SOURCE_EXTENSIONS);
  const aliases: Record<string, string[]> = {};

  // Source candidates first and in `SOURCE_EXTENSIONS` order, so `./Widget.js`
  // prefers `Widget.ts` over a `Widget.js` a build step left beside it.
  for (const source of SOURCE_EXTENSIONS) {
    if (!source.startsWith("t")) continue;
    const emitted = source === "tsx" ? ["js", "jsx"] : [`j${source.slice(1)}`];
    for (const spelling of emitted) (aliases[`.${spelling}`] ??= []).push(`.${source}`);
  }

  // The emitted extension itself, LAST — `extensionAlias` replaces the extension
  // rather than adding to it, so without this a real `./legacy.js` beside its
  // `.ts` neighbours stops resolving. Only when this tree reads that extension
  // at all: resolving to a file no walker opens puts a module in the graph that
  // no check governs.
  for (const [spelling, candidates] of Object.entries(aliases)) {
    if (sources.has(spelling.slice(1))) candidates.push(spelling);
  }
  return aliases;
}

/**
 * One resolver for one declared tree, configured entirely from that tree's
 * vocabulary.
 *
 * Every value below is a name this tree already spells somewhere else — the
 * extensions the walkers read, the tree's alias prefix, the tree's barrel module
 * — so adopting this adds no knob. That matters more than it sounds: a resolver
 * with an `extensions` list of its own is the `api/barrel-purity` defect one
 * layer down, where the check listed two of the eight extensions the walkers had
 * and every `.mts` hop ended a trace in silence.
 */
export function createTreeModuleResolver(
  vocabulary: TreeVocabulary,
  sourceRoot: string,
): TreeModuleResolver {
  const { aliasPrefix } = vocabulary;
  // oxc matches an alias key on whole segments, so the key is the prefix without
  // its trailing separator: `@` matches `@/features/x` and does NOT match
  // `@tanstack/react-query`, which is the distinction `classifySpecifier` makes
  // in the other tier and has to keep making here.
  const aliasKey = aliasPrefix.endsWith("/") ? aliasPrefix.slice(0, -1) : aliasPrefix;

  const factory = new ResolverFactory({
    extensions: SOURCE_EXTENSIONS.map((extension) => `.${extension}`),
    extensionAlias: extensionAliases(),
    // The CLIENT barrel only, which is what a bundler resolves a directory to.
    // Adding the server barrel would make `@/features/x` land on `index.server`
    // in a feature that has only the server one — a module that specifier cannot
    // reach in the real build, reported as though it could.
    mainFiles: [vocabulary.clientBarrelModule],
    // Emptied, not defaulted. See the NEGATIVE SPACE note: a `package.json`
    // inside the source tree is an adopter-writable redirect, and oxc honours
    // `main` and `exports` unless told not to.
    mainFields: [],
    exportsFields: [],
    alias: { [aliasKey]: [sourceRoot] },
    symlinks: false,
  });

  return (fromFile, specifier) => {
    // The asset test is `policy/layout.ts`'s, which is what the oxlint tier reads
    // too. A private copy here drifted from that one silently: one configured
    // edge, two verdicts, and the tier that resolved it reported findings the
    // other never would. It reads the query-stripped path, and so does
    // everything below it.
    if (isAssetSpecifier(vocabulary, specifier)) return undefined;
    const module = specifier.split("?")[0] ?? specifier;

    const aliased = module.startsWith(aliasPrefix);
    if (!aliased && !module.startsWith(".")) return undefined;

    // What the specifier CLAIMS, before the disk is consulted. Computed either
    // way, because it is the answer when nothing on disk backs the import and
    // because it is what decides whether this tree is being addressed at all.
    const claimed = relative(
      sourceRoot,
      aliased
        ? resolve(sourceRoot, module.slice(aliasPrefix.length))
        : resolve(dirname(fromFile), module),
    );
    // Both this and the post-resolution test below are the same invariant — an
    // edge leaving the tree is not in the tree's graph — asked of the two paths
    // that can leave it. Neither covers the other: `@/../vite.config` never
    // reaches the resolver, and a resolved path can escape a claim that did not.
    if (claimed.startsWith("..")) return undefined;

    const found = factory.sync(dirname(fromFile), module).path;
    if (found === undefined) return { resolved: false, sourcePath: claimed };

    const sourcePath = relative(sourceRoot, found);
    if (sourcePath.startsWith("..")) return undefined;

    return { resolved: true, absolute: found, sourcePath };
  };
}
