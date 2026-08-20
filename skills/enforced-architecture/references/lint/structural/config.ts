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
// trace limits and package names. Every one of those is a number or a name that
// says nothing about the shape of the tree.
//
// And every one of them is a number or a NAME. No field here is a regex, a glob
// or a list an adopter grows: a predicate is a rule's own claim, and handed over
// as configuration it becomes an off-switch that leaves the check listed as
// enabled — `behaviorKeywords: /.*/` took `health/trampolines` from four
// findings to zero in this repo's own fixtures. Where a check needed a
// predicate, it now holds one; where it needed an exemption, it reads a
// structural fact. A check with nothing left to configure has no entry at all.
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
  /**
   * Packages that break a client bundle, by NAME. A subpath import
   * (`drizzle-orm/pg-core`) is the same package, so one entry covers it — that
   * is `packageNameOf`, shared with the oxlint tier, rather than each entry
   * carrying its own anchoring.
   *
   * Names rather than regexes because a pattern list is a predicate: `^$` in one
   * entry matches nothing and reads exactly like a package that happens not to
   * be installed. Node builtins are not listed — `node:` is a protocol, and a
   * builtin in a client barrel is server-only by construction rather than by
   * this project's opinion.
   */
  serverOnlyPackages: string[];
  /** Bounds cost only — cycle detection is what stops infinite recursion. Report when hit. */
  maxTraceDepth: number;
  /**
   * The framework calls that mark a module as a server-function boundary. The
   * framework replaces those bodies with RPC stubs, so the trace stops there.
   *
   * A name per entry, checked at startup: an empty entry is a substring of every
   * module, so one of them stops the trace at the first file and every
   * transitive server-only import disappears while the check still runs.
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
   * NEGATIVE SPACE: there is no exclusion list. A per-file pass is how a size
   * limit becomes advisory — the list grows by one entry per commit that would
   * otherwise fail, each with a TODO nobody returns to, and the threshold ends
   * up describing the files nobody had a reason to exempt. The thresholds are
   * the knob; a project whose files are legitimately longer raises them, in one
   * place, visibly.
   */
};

export type TrampolinesConfig = {
  /**
   * Feature layers scanned, named by ROLE rather than by directory. The tree's
   * vocabulary spells each role, so a project renaming `service/` renames it
   * once and this follows.
   *
   * Checked at startup for two things prose used to ask for: at least one role,
   * because an empty list is the check walking nothing, and never the repo role,
   * because thin DB wrappers are its job and a check that reports them reports
   * the layer working. A prohibition nothing enforces is the shape this catalog
   * exists to distrust.
   */
  targetLayerRoles: FeatureLayerRole[];
};

export type ShadowSourceConfig = {
  /**
   * The one curated home, source-root-relative. Readable in one screen.
   *
   * A name, and singular: the check's claim is that ONE file lists every shadow,
   * so a list here would be the claim itself made adjustable.
   */
  allowedFile: string;
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
  "style/shadow-source": ShadowSourceConfig;
  "style/token-equality": TokenEqualityConfig;
};

/**
 * Rejects a config whose values would switch a check off while leaving it registered.
 *
 * Called by `runStructuralChecks` before anything runs, so an adopting project's own
 * `arch.config.ts` is held to it rather than only this file's defaults. Thresholds are not checked:
 * a number set too high reports less and says so in the diff, which is the adaptation this catalog
 * grants. What it refuses is a value that makes a predicate a tautology — the empty string, and the
 * empty list where empty means "walk nothing".
 */
export function assertGoverningConfig(config: ArchitectureConfig): void {
  for (const marker of config.checks["api/barrel-purity"].serverFnMarkers) {
    if (/^[A-Za-z_$][\w$]*$/.test(marker)) continue;
    throw new Error(
      `serverFnMarkers entry "${marker}" is not a call name. Each entry is matched as source ` +
        `text, so an empty or partial one marks every module a server-function boundary and the ` +
        `barrel trace stops at the first file it opens — with the check still registered and ` +
        `still reporting nothing.`,
    );
  }

  const { targetLayerRoles } = config.checks["health/trampolines"];
  if (targetLayerRoles.length === 0) {
    throw new Error(
      `health/trampolines has no targetLayerRoles, so it walks no directory at all. Name the ` +
        `layers whose forwarding functions are the subject — the default is the service role.`,
    );
  }
  if (targetLayerRoles.includes("repo")) {
    throw new Error(
      `health/trampolines cannot target the repo role. A thin wrapper on a query is that layer's ` +
        `job, so the check would report the layer working — and the flood is what gets a ` +
        `warning-level check switched off everywhere else too.`,
    );
  }
}

export const defaultCheckConfigs: CheckConfigs = {
  "api/barrel-purity": {
    serverOnlyPackages: ["drizzle-orm", "pg", "postgres", "better-auth", "stripe"],
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
  },

  "health/trampolines": {
    targetLayerRoles: ["service"],
  },

  "style/shadow-source": {
    allowedFile: "shadows.css",
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
