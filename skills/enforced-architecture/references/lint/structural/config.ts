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
// ── What is NOT here ──────────────────────────────────────────────────
//
// Where the trees are and what their directories are called. That is
// `lint/policy/declared-trees.ts`, which both tiers read, and it is deliberately
// not reachable from this object: a config field naming a source root or a layer
// is a second answer to a question the oxlint tier answers from the policy
// module, and the two tiers then police two different trees while both report
// clean. That was the state this file was in, and the config could express it.
//
// What remains here is what has no bearing on WHERE the architecture is: the
// project root every relative path resolves against, the build fact of which
// package injects JSX runtime imports, and per-check thresholds, manifests,
// trace limits and allowlists. Every one of those is a number or a name that
// says nothing about the shape of the tree.
//
// ── Adapt ─────────────────────────────────────────────────────────────
//
// Write this beside the checks and pass it to `runStructuralChecks`:
//
//   // lint/structural/arch.config.ts
//   import { resolve } from "node:path";
//   import { radius, spacing } from "../../src/shared/ui/theme.ts";
//   import { type ArchitectureConfig, defaultCheckConfigs } from "./config.ts";
//
//   export const architectureConfig: ArchitectureConfig = {
//     projectRoot: resolve(import.meta.dir, "../.."),
//     jsxImportSource: "react",
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

import type { FeatureLayerRole } from "../policy/layout.ts";

export type BarrelPurityConfig = {
  /** Packages that break a client bundle. Regexes: `^name$` exact, `^name/` for subpaths. */
  serverOnlyPatterns: RegExp[];
  /** Bounds cost only — cycle detection is what stops infinite recursion. Report when hit. */
  maxTraceDepth: number;
  /**
   * Source text that marks a module as a server-function boundary. The framework
   * replaces those bodies with RPC stubs, so the trace stops there.
   */
  serverFnMarkers: string[];
};

export type FeatureVisibilityConfig = {
  /** The grant file at each feature's root: importing feature name → justification. */
  visibilityFilename: string;
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
  /**
   * Project-relative roots walked for size, and the one root list that is NOT a
   * declared tree. File size is a health signal about anything a human maintains
   * — a config package, a scripts directory, a workspace this catalog does not
   * govern architecturally — so this check is project-scoped and says so.
   */
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
  /**
   * Feature layers scanned, named by ROLE rather than by directory. The tree's
   * vocabulary spells each role, so a project renaming `service/` renames it
   * once and this follows. Never add the repo role — thin DB wrappers are its
   * job, and a check that reports them reports the layer working.
   */
  targetLayerRoles: FeatureLayerRole[];
  /** Any of these in a function body means it does something beyond forwarding. */
  behaviorKeywords: RegExp;
};

export type BarrelDiscoverabilityConfig = {
  /** Whether `export type { X as Y }` is flagged too. Types are reverse-looked-up less often. */
  flagTypeAliases: boolean;
};

export type TestFileMirrorConfig = {
  /**
   * The blessed suffixes, WITHOUT an extension. Pick ONE convention and enforce
   * it.
   *
   * Extensionless because the extension is not part of the convention: a project
   * that writes `.test.ts` writes `.test.mts` too, and spelling each pairing out
   * meant `SOURCE_EXTENSIONS` grew to eight while this list covered two — so an
   * `.mts` test was not recognised as a test, and the check that exists to make
   * tests findable said nothing about them.
   */
  testSuffixes: string[];
  /** Off-convention spellings, actively steered toward the canonical suffix. */
  nonconforming: RegExp[];
  /**
   * Source-root-relative directories where a test with no sibling source is
   * legitimate — cross-cutting suites that map to no single module.
   */
  orphanAllowedDirs: string[];
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
};

/**
 * Per-check knobs, keyed by the catalog rule id so a config entry and the rule
 * it configures are one grep apart. Checks with nothing to configure have no
 * entry — their behaviour comes entirely from the tree they are run against.
 */
export type CheckConfigs = {
  "api/barrel-purity": BarrelPurityConfig;
  "api/feature-visibility": FeatureVisibilityConfig;
  "graph/feature-deps": FeatureDepsConfig;
  "health/doc-budgets": DocBudgetsConfig;
  "health/file-size": FileSizeConfig;
  "health/trampolines": TrampolinesConfig;
  "naming/barrel-discoverability": BarrelDiscoverabilityConfig;
  "naming/test-file-mirror": TestFileMirrorConfig;
  "style/css-tokens": CssTokensConfig;
  "style/shadow-source": ShadowSourceConfig;
  "style/token-equality": TokenEqualityConfig;
};

export const defaultCheckConfigs: CheckConfigs = {
  "api/barrel-purity": {
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
  },

  "api/feature-visibility": {
    visibilityFilename: "visibility.json",
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
    targetLayerRoles: ["service"],
    behaviorKeywords: /\b(const|let|var|if|for|while|switch|try|throw|catch)\b/,
  },

  "naming/barrel-discoverability": {
    flagTypeAliases: true,
  },

  "naming/test-file-mirror": {
    testSuffixes: [".test", ".integration.test"],
    nonconforming: [/\.spec\.[tj]sx?$/, /(^|\/)test_[^/]+\.[tj]sx?$/],
    orphanAllowedDirs: [],
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
  },
};

export type ArchitectureConfig = {
  /** Absolute path every project-relative path in this object resolves against. */
  projectRoot: string;
  /**
   * `compilerOptions.jsxImportSource` from the project's tsconfig. Under a JSX
   * loader Bun's reader reports runtime imports it injected rather than ones the
   * file wrote; this names the package whose surplus `require-call` entries get
   * filtered. See the extraction notes in `import-graph.ts`.
   *
   * A build fact, not an architectural one, which is why it survived the move of
   * everything else in `source` to the declared-tree list.
   */
  jsxImportSource: string;
  checks: CheckConfigs;
};
