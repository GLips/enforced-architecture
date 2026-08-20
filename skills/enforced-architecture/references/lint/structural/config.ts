// ─── The structural tier's configuration ───────────────────────
//
// Every knob the script checks read lives here, in ONE object per project.
// Adopting this tier in a new codebase means writing an `arch.config.ts` that
// spreads the defaults below and overrides what differs — never editing a
// constant inside a check body.
//
// That constraint is the reason this file exists. The three deployments that
// hand-rolled these checks from prose each buried their roots and thresholds in
// the check that used them, so `check-layer-occupancy.ts` hardcoded
// `src/features` while its own documentation promised a configurable root, and
// nobody could tell by reading either one. A knob in a shared object is a knob
// a reader can enumerate; a knob in a function body is a fact about one repo.
//
// ── Adapt ─────────────────────────────────────────────────────────────
//
// Write this beside the checks and pass it to `runStructuralChecks`:
//
//   // lint/structural/arch.config.ts
//   import { resolve } from "node:path";
//   import { radius, spacing } from "../../src/shared/ui/theme.ts";
//   import {
//     type ArchitectureConfig,
//     defaultCheckConfigs,
//     defaultSourceConfig,
//   } from "./config.ts";
//
//   export const architectureConfig: ArchitectureConfig = {
//     projectRoot: resolve(import.meta.dir, "../.."),
//     source: { ...defaultSourceConfig, roots: ["apps/web/src"] },
//     checks: {
//       ...defaultCheckConfigs,
//       "style/token-equality": {
//         ...defaultCheckConfigs["style/token-equality"],
//         spacingScale: spacing,
//         radiusScale: radius,
//       },
//     },
//   };
//
// Spreads rather than a deep merge, deliberately: an override is then visible in
// the diff as the whole value it replaces, and there is no merge semantics to
// learn before you can predict what a config does.
//
// ──────────────────────────────────────────────────────────────────────

/**
 * Facts about the source tree that more than one check needs. Getting one of
 * these wrong makes several checks quietly wrong together, which is the argument
 * for stating them once.
 */
export type SourceConfig = {
  /**
   * Project-relative roots the checks walk. The FIRST root is the import
   * graph's source root: the alias prefix resolves against it and boundary
   * classification is relative to it. Extra roots are walked by the checks that
   * take a root list but do not participate in the graph.
   */
  roots: string[];

  /** How the source root is spelled in a specifier. `@/features/x` → `<root>/features/x`. */
  aliasPrefix: string;

  /**
   * Top-level directories whose CHILDREN are the boundary rather than
   * themselves — `features/board` is a boundary, `features` is not. Not always
   * these two: a source root that subdivides `packages/` or `modules/` names
   * those instead.
   */
  subdividedDirs: string[];

  /**
   * Which subdivided directory holds features, and which holds domains. The
   * rules that speak about one or the other by name (`graph/feature-deps`,
   * `graph/domain-cycles`, `api/feature-visibility`) read these rather than
   * assuming a spelling, so a project that calls them `modules/` and `core/`
   * renames in one place.
   */
  featuresDirName: string;
  domainsDirName: string;

  /**
   * Intra-feature layers, highest to lowest. `placement/layer-direction` reads
   * the order; a project inserting a layer adds it here in position and every
   * consumer follows. That single point of change is most of the argument for
   * building the import graph once.
   */
  layerOrder: string[];

  /**
   * Paths no check reads: tests, generated output, declaration files, and the
   * check tooling itself. Stated once so a rule cannot restate them slightly
   * differently and govern a different set of files than its neighbour.
   */
  exclude: RegExp[];

  /**
   * Specifier suffixes that resolve inside the source root but are not module
   * edges. Load-bearing, not defensive: `../styles.css?url` from a route
   * resolves to a real file and otherwise surfaces as a boundary crossing with
   * a filename where a boundary name should be.
   */
  assetExtensions: string[];

  /**
   * `compilerOptions.jsxImportSource` from the project's tsconfig. Under a JSX
   * loader Bun's reader reports runtime imports it injected rather than ones the
   * file wrote; this names the package whose surplus `require-call` entries get
   * filtered. See the extraction notes in `import-graph.ts`.
   */
  jsxImportSource: string;
};

export const defaultSourceConfig: SourceConfig = {
  roots: ["src"],
  aliasPrefix: "@/",
  subdividedDirs: ["features", "domains"],
  featuresDirName: "features",
  domainsDirName: "domains",
  layerOrder: ["ui", "controllers", "service", "repo"],
  exclude: [
    /\.test\.[tj]sx?$/,
    /\.integration\.test\.[tj]sx?$/,
    /\/__tests__\//,
    /\/src\/test\//,
    /\.gen\.[tj]sx?$/,
    /\.d\.ts$/,
  ],
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
  jsxImportSource: "react",
};

export type BarrelPurityConfig = {
  /**
   * Project-relative directories whose immediate children hold a public barrel.
   * Relative to the source root, not the project root.
   */
  barrelDirs: string[];
  /** Barrel filenames traced. `index.server.ts` is server-only by construction and excluded. */
  barrelFilenames: string[];
  /** Packages that break a client bundle. Regexes: `^name$` exact, `^name/` for subpaths. */
  serverOnlyPatterns: RegExp[];
  /** Bounds cost only — cycle detection is what stops infinite recursion. Report when hit. */
  maxTraceDepth: number;
  /**
   * Source text that marks a module as a server-function boundary. The framework
   * replaces those bodies with RPC stubs, so the trace stops there.
   */
  serverFnMarkers: string[];
  /**
   * Subdivided directories where the server-function short-circuit applies.
   * Features re-export server functions from controllers; domains never define
   * them, so tracing a domain barrel must not stop at a false marker.
   */
  serverFnBoundaryDirs: string[];
};

export type FeatureVisibilityConfig = {
  /** The grant file at each feature's root: importing feature name → justification. */
  visibilityFilename: string;
};

export type LayerOccupancyConfig = {
  /**
   * Resolved path (from the source root) of the DB schema modules. Compared as a
   * resolved path, so `../../infrastructure/db/schema/x` and the aliased
   * spelling are one edge. Prefix match: anything under it counts.
   */
  schemaTarget: string;
  /** Layer directory names, so the two bypass questions can be asked by name. */
  repoLayer: string;
  serviceLayer: string;
  controllerLayer: string;
};

export type FeatureDepsConfig = {
  /** Unique feature→feature edges across the project before the graph is a web, not a tree. */
  totalEdgeThreshold: number;
  /** Files inside one feature importing the same other feature before the dependency is pervasive. */
  pairSaturationThreshold: number;
  /** Distinct features one feature may import from. */
  fanOutThreshold: number;
};

export type DocBudgetsConfig = {
  /**
   * Project-relative path of the word-ceiling manifest: a flat JSON object of
   * doc path → integer ceiling. The budgets live in their own file rather than
   * here because raising one has to read as a documentation decision in the diff
   * that needed it, not as a line in the file every check is configured from.
   */
  manifestPath: string;
};

export type FileSizeConfig = {
  /** Roots walked for size. Often wider than `source.roots` — a shared package counts too. */
  roots: string[];
  warnThreshold: number;
  failThreshold: number;
  /**
   * Known-oversized files, matched by path suffix. An escape hatch, never a
   * permanent pass: every entry carries a TODO naming how it gets back under.
   */
  exclusions: string[];
};

export type TrampolinesConfig = {
  /** Layer directory names scanned. Never add the repo layer — thin DB wrappers are its job. */
  targetLayers: string[];
  /** Any of these in a function body means it does something beyond forwarding. */
  behaviorKeywords: RegExp;
};

export type BarrelDiscoverabilityConfig = {
  /** Globs, relative to the source root, naming the public barrels. */
  barrelGlobs: string[];
  /** Whether `export type { X as Y }` is flagged too. Types are reverse-looked-up less often. */
  flagTypeAliases: boolean;
};

export type TestFileMirrorConfig = {
  /** The blessed suffixes. Pick ONE convention and enforce it. */
  testSuffixes: string[];
  /** Off-convention spellings, actively steered toward the canonical suffix. */
  nonconforming: RegExp[];
  /**
   * Source-root-relative directories where a test with no sibling source is
   * legitimate — cross-cutting suites that map to no single module.
   */
  orphanAllowedDirs: string[];
};

/**
 * The path grammar inside ONE subdivided directory. It is per-directory because
 * `features/` and `domains/` are genuinely different shapes, and the difference
 * is not stylistic — it follows from what the other rules key on.
 *
 * Feature-scoped rules key on `features/<name>/<layer>/`, so a directory inside
 * a feature that is not a layer is reached by nothing and has to be rejected.
 * Domain-scoped rules key on `domains/<name>/` and reach the entire subtree, so
 * a module at a domain root is fully governed and there is nothing for a path to
 * escape into. Applying the feature grammar to domains rejects the layout
 * `directory-model.md` recommends — internal modules at the domain root — which
 * is this rule's own named failure mode.
 */
export type BoundaryGrammar =
  | {
      kind: "layered";
      /** Files at a boundary root: its public surface, plus its error types. */
      rootFiles: string[];
      /** The closed set of directory names one level inside a boundary. */
      layers: string[];
    }
  | { kind: "unlayered" };

export type TopologyConfig = {
  /** The closed set of first path segments under the source root. */
  allowedRoots: string[];
  /**
   * Files sitting directly in the source root. Entrypoints and env modules are
   * not layers, and a directory-only whitelist rejects them — which is the first
   * thing this rule gets wrong.
   */
  allowedRootFiles: string[];
  /** Keyed by directory name, and every entry of `source.subdividedDirs` needs one. */
  boundaries: Record<string, BoundaryGrammar>;
};

export type CssTokensConfig = {
  /** Stylesheet extensions walked, without the dot. */
  stylesheetExtensions: string[];
  /**
   * Source-root-relative token-source stylesheets. These DEFINE the raw values,
   * which is what a token declaration is.
   */
  exemptFiles: string[];
};

export type ShadowSourceConfig = {
  /** The one curated home, source-root-relative. Readable in one screen. */
  allowedFile: string;
  /** Extensions scanned, without the dot. Stylesheets and TS together — that is the point. */
  scannedExtensions: string[];
  /** The property spelling per surface: CSS in stylesheets, the JS key in TS/TSX. */
  stylesheetPattern: RegExp;
  scriptPattern: RegExp;
};

export type TokenEqualityConfig = {
  /**
   * The scales, taken from the project's theme module by the config file that
   * imports it. Values are CSS lengths (`"1rem"`, `"16px"`) or px numbers. Never
   * restate a scale here — importing it is what stops the enforcer drifting from
   * the thing it guards, and is the whole reason this axis is a script.
   */
  spacingScale: Record<string, string | number>;
  radiusScale: Record<string, string | number>;
  /** JSX props and style-object keys carrying each scale. Extend to the primitives you ship. */
  spacingProps: string[];
  radiusProps: string[];
  spacingKeys: string[];
  radiusKeys: string[];
  /** Paths carrying no styling, or defining the scale itself. Source-root-relative regexes. */
  exemptPaths: RegExp[];
};

/**
 * Per-check knobs, keyed by the catalog rule id so a config entry and the rule
 * it configures are one grep apart. Checks with nothing to configure have no
 * entry — their behaviour comes entirely from `SourceConfig`.
 */
export type CheckConfigs = {
  "api/barrel-purity": BarrelPurityConfig;
  "api/feature-visibility": FeatureVisibilityConfig;
  "boundary/layer-occupancy": LayerOccupancyConfig;
  "graph/feature-deps": FeatureDepsConfig;
  "health/doc-budgets": DocBudgetsConfig;
  "health/file-size": FileSizeConfig;
  "health/trampolines": TrampolinesConfig;
  "naming/barrel-discoverability": BarrelDiscoverabilityConfig;
  "naming/test-file-mirror": TestFileMirrorConfig;
  "placement/topology": TopologyConfig;
  "style/css-tokens": CssTokensConfig;
  "style/shadow-source": ShadowSourceConfig;
  "style/token-equality": TokenEqualityConfig;
};

export const defaultCheckConfigs: CheckConfigs = {
  "api/barrel-purity": {
    barrelDirs: ["domains", "features"],
    barrelFilenames: ["index.ts", "index.tsx"],
    serverOnlyPatterns: [
      /^node:/,
      /^drizzle-orm/,
      /^pg$/,
      /^postgres$/,
      /^better-auth/,
      /^stripe$/,
    ],
    maxTraceDepth: 6,
    serverFnMarkers: ["createServerFn"],
    serverFnBoundaryDirs: ["features"],
  },

  "api/feature-visibility": {
    visibilityFilename: "visibility.json",
  },

  "boundary/layer-occupancy": {
    schemaTarget: "infrastructure/db/schema",
    repoLayer: "repo",
    serviceLayer: "service",
    controllerLayer: "controllers",
  },

  // Starting points, not invariants. A project with 15 features naturally has
  // more edges than one with 3 — calibrate with `--baseline` and set these just
  // above the current state, so they signal growth rather than fire on day one.
  "graph/feature-deps": {
    totalEdgeThreshold: 4,
    pairSaturationThreshold: 3,
    fanOutThreshold: 2,
  },

  "health/doc-budgets": {
    manifestPath: "docs/doc-budgets.manifest.json",
  },

  "health/file-size": {
    roots: ["src"],
    warnThreshold: 500,
    failThreshold: 600,
    exclusions: [],
  },

  "health/trampolines": {
    targetLayers: ["service"],
    behaviorKeywords: /\b(const|let|var|if|for|while|switch|try|throw|catch)\b/,
  },

  "naming/barrel-discoverability": {
    barrelGlobs: [
      "domains/*/index.ts",
      "domains/*/index.server.ts",
      "features/*/index.ts",
      "features/*/index.server.ts",
    ],
    flagTypeAliases: true,
  },

  "naming/test-file-mirror": {
    testSuffixes: [
      ".test.ts",
      ".test.tsx",
      ".integration.test.ts",
      ".integration.test.tsx",
    ],
    nonconforming: [/\.spec\.[tj]sx?$/, /(^|\/)test_[^/]+\.[tj]sx?$/],
    orphanAllowedDirs: [],
  },

  "placement/topology": {
    allowedRoots: ["routes", "features", "domains", "infrastructure", "shared"],
    allowedRootFiles: [
      "env.ts",
      "env.server.ts",
      "env.client.ts",
      "router.tsx",
      "client.tsx",
      "server.ts",
      "styles.css",
    ],
    boundaries: {
      features: {
        kind: "layered",
        rootFiles: ["index.ts", "index.server.ts", "errors.ts"],
        layers: ["ui", "controllers", "service", "repo"],
      },
      domains: { kind: "unlayered" },
    },
  },

  "style/css-tokens": {
    stylesheetExtensions: ["css"],
    exemptFiles: ["styles.css"],
  },

  "style/shadow-source": {
    allowedFile: "shadows.css",
    scannedExtensions: ["css", "ts", "tsx"],
    stylesheetPattern: /\bbox-shadow\b/,
    scriptPattern: /\bboxShadow\b/,
  },

  // Empty scales mean the check has nothing to compare against and stays silent.
  // The project's config file imports the real ones from its theme module.
  "style/token-equality": {
    spacingScale: {},
    radiusScale: {},
    spacingProps: [
      "gap",
      "p",
      "px",
      "py",
      "pt",
      "pr",
      "pb",
      "pl",
      "m",
      "mx",
      "my",
      "mt",
      "mr",
      "mb",
      "ml",
    ],
    radiusProps: ["radius"],
    spacingKeys: [
      "padding",
      "paddingTop",
      "paddingRight",
      "paddingBottom",
      "paddingLeft",
      "paddingInline",
      "paddingBlock",
      "margin",
      "marginTop",
      "marginRight",
      "marginBottom",
      "marginLeft",
      "marginInline",
      "marginBlock",
      "gap",
      "rowGap",
      "columnGap",
    ],
    radiusKeys: [
      "borderRadius",
      "borderTopLeftRadius",
      "borderTopRightRadius",
      "borderBottomLeftRadius",
      "borderBottomRightRadius",
    ],
    exemptPaths: [/^domains\//],
  },
};

export type ArchitectureConfig = {
  /** Absolute path every project-relative path in this object resolves against. */
  projectRoot: string;
  source: SourceConfig;
  checks: CheckConfigs;
};
