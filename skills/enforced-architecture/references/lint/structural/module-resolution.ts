// ─── Where a specifier lands ──────────────────────────────────────────
//
// Makes sure of nothing on its own. This is the tier's ONE answer to "which
// module does this import name", consumed by `import-graph` (which compares the
// two ends of every edge as paths) and by `api/barrel-purity` (which has to open
// the next file in a chain). Both of those hand-rolled the answer separately,
// and the two disagreed: the graph produced a path whether or not a file backed
// it, while the trace tried a fixed suffix list against the disk and gave up
// silently when none matched. One edge, two verdicts, and the quiet one was the
// one that mattered.
//
// The real resolution comes from `oxc-resolver` — the resolver from the same
// project as the oxlint this catalog already ships. What it buys over path
// arithmetic is everything TypeScript does that a path cannot see: `./rows.js`
// naming `rows.ts`, `@/features/orders` naming that feature's barrel, a
// directory with a `package.json` naming its own entry. `api/barrel-purity`'s
// header used to carry an apology for the first of those; it does not any more.
//
// ── Two answers, and the second one is why this is not just the resolver ──
//
// `resolveTreeModule` returns `resolved: false` with a sourcePath when the
// specifier NAMES a position inside this tree that no file on disk backs. That
// arm is load-bearing and is not a fallback in the apologetic sense: dropping
// the edge instead would mean a specifier the resolver cannot follow — a module
// declared only in a `.d.ts`, one a bundler plugin materialises, one whose file
// is mid-rename — vanishes from the graph, and every boundary rule reports clean
// over an import nobody checked. That is fail-open, in the one tier whose whole
// job is to make a silent gap impossible.
//
// So resolution SHARPENS an edge and never deletes one. A consumer that must
// read the file reads `resolved`; a consumer comparing positions reads
// `sourcePath` and gets the same answer it always got when the disk has nothing
// to add.
//
// ── NEGATIVE SPACE ────────────────────────────────────────────────────
//
// No tsconfig. `oxc-resolver` reads `paths` and this deliberately does not ask
// it to. A second path mapping known here and not to `policy/layout.ts`'s
// `classifySpecifier` gives one specifier two meanings across the two tiers,
// which is the contract the engine rests on — and `tsconfig.json` is a file the
// adopting project edits, so a rule whose scope followed it would be a rule with
// an off-switch. This tree's alias prefix is its vocabulary and is the whole of
// what is aliased.
//
// No node_modules, and no bare specifiers at all. A package name is not a
// boundary question this tier answers — `api/barrel-purity` reads package names
// off the scan, never off resolution — so they are refused before the resolver
// is asked, which is also why nothing here walks a node_modules tree.
//
// Symlinks are NOT followed. A symlinked feature directory keeps the name it is
// reached through, because which of its names is canonical is
// `api/feature-visibility`'s question and it resolves that itself. Following
// them here would move five fixture edges out of the source root entirely and
// take their findings with them.
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
 * this. The mapping is TypeScript's own and is derived rather than listed: an
 * emitted extension is its source extension with the `t` swapped for a `j`
 * (`ts`→`js`, `mts`→`mjs`, `cts`→`cjs`, `tsx`→`jsx`), so inverting that swap
 * recovers the source. `.js` additionally admits `.tsx` and `.jsx`, because a
 * module holding JSX emits `.js` like any other.
 *
 * Derived from `SOURCE_EXTENSIONS` for the reason `JSX_SOURCE_EXTENSIONS` is:
 * a hand-written pair list is how an extension the walkers read becomes one the
 * resolver cannot follow, and a hop that cannot be followed reports nothing.
 */
function extensionAliases(): Record<string, string[]> {
  const sources = new Set(SOURCE_EXTENSIONS);
  const aliases: Record<string, string[]> = {};
  for (const source of SOURCE_EXTENSIONS) {
    if (!source.startsWith("t")) continue;
    const emitted = `j${source.slice(1)}`;
    if (!sources.has(emitted)) continue;
    // Ordered source-first, so `./Widget.js` prefers `Widget.ts` over a
    // `Widget.js` that a build step left beside it.
    (aliases[`.${emitted}`] ??= []).push(`.${source}`);
  }
  for (const [emitted, candidates] of Object.entries(aliases)) {
    candidates.push(emitted);
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
    alias: { [aliasKey]: [sourceRoot] },
    symlinks: false,
  });

  return (fromFile, specifier) => {
    // The asset test is `policy/layout.ts`'s, which is what the oxlint tier reads
    // too. A private copy here drifted from that one silently: one configured
    // edge, two verdicts, and the tier that resolved it reported findings the
    // other never would.
    if (isAssetSpecifier(vocabulary, specifier)) return undefined;

    const aliased = specifier.startsWith(aliasPrefix);
    if (!aliased && !specifier.startsWith(".")) return undefined;

    // What the specifier CLAIMS, before the disk is consulted. Computed either
    // way, because it is the answer when nothing on disk backs the import and
    // because it is what decides whether this tree is being addressed at all.
    const claimed = relative(
      sourceRoot,
      aliased
        ? resolve(sourceRoot, specifier.slice(aliasPrefix.length))
        : resolve(dirname(fromFile), specifier),
    );
    if (claimed.startsWith("..")) return undefined;

    const found = factory.sync(dirname(fromFile), specifier).path;
    if (found === undefined) return { resolved: false, sourcePath: claimed };

    const sourcePath = relative(sourceRoot, found);
    // Resolution landed outside this tree — through a `package.json` entry
    // pointing up and out, or an alias value a future vocabulary allows. An edge
    // leaving the tree is not in the tree's graph, exactly as a bare package
    // specifier is not; answering with the claimed path instead would put a
    // position in the graph that holds no code.
    if (sourcePath.startsWith("..")) return undefined;

    return { resolved: true, absolute: found, sourcePath };
  };
}
