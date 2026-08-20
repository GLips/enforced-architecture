// ─── policy/import-policy — one table, one evaluator, two callers ────────────
//
// Tag:       boundary
// Mechanism: pure policy, read by both enforcement tiers
// Blocking:  Yes, in both
//
// Prevents:  Every import direction and every exposure decision in the layout
//            `import-boundaries.md` describes, declared once over an exhaustive
//            key instead of scattered across five rules that each carried a
//            slice of it.
//
// Five rules held overlapping copies of this and the copies disagreed:
// `shared-purity` banned every `@/` import from `src/shared/*.ts` while
// `shared-ui-purity` allowed `@/shared/…` from `src/shared/ui/`, so
// `shared/ui → shared/theme` passed both — to the first the file IS shared, to
// the second the target is not a feature. Nobody owned the edge. Coverage with N
// rules is whatever the union of their path regexes happens to be, and the holes
// are INVISIBLE: `infrastructure → routes`, `service → infrastructure` and
// `route → domains` were each guarded by nothing and nothing said so. Declared
// over `SourceProfile × TargetArea`, an unfilled cell is a compile error and an
// unguarded edge cannot exist.
//
// ── Who reads this ───────────────────────────────────────────────────────────
//
//   lint/oxlint/boundary/import-policy.ts       aliased specifiers and bare packages
//   lint/structural/boundary/import-policy.ts   resolved relative edges
//
// The split is inherent in the data, not a partition anyone maintains. A package
// has no relative spelling, so oxlint owns package policy completely; a relative
// path cannot be resolved by a linter at all, so the graph owns those. Both hand
// this module the SAME source-root-relative string, so the two spellings of one
// edge cannot reach different verdicts.
//
// That is also what makes coverage durable rather than inherited. An
// oxlint-only engine would depend on the alias-spelling check normalising every
// crossing before the engine saw it — one check guaranteeing another's
// completeness, with nothing verifying the link. Here, if alias reporting breaks,
// a forbidden relative edge still gets its semantic denial; only the spelling
// diagnostic is lost.
//
// ── What this table does NOT answer, and who does ─────────────────────────────
//
// A cell says whether the DIRECTION is open and through what surface. Four rules
// in the catalog narrow cells this table leaves at `any`, and each survives
// because its question is finer than an area:
//
//   boundary/client-server-infra  which infrastructure modules are client-safe.
//                                 Every `infrastructure: "any"` cell on a client
//                                 profile is narrowed by that allowlist.
//   boundary/db-isolation         which modules may name `infrastructure/db`.
//   api/server-import-context     which callers may name a unit's `index.server`
//                                 barrel — the `barrel` surface admits both
//                                 spellings, and that rule decides which of them
//                                 a given caller gets.
//   boundary/layer-occupancy      whether a permitted downward edge SKIPS a layer
//                                 that exists. That is a filesystem question.
//
// `any` therefore means "this policy permits the direction", never "nothing else
// checks it". Folding those four in was considered and refused: each is keyed by
// an exact module or by the filesystem rather than by an area, and reaching a
// shape where one table could express them forces cells that state something
// untrue so the machinery can work.
//
// ── Adapt ────────────────────────────────────────────────────────────────────
//
// Change a cell, not a rule. The row is the position a file occupies and the
// column is where its import lands; `ImportSurface` is what the cell grants, and it
// carries the exposure question with it so `deny` stays a DIRECTION message and a
// surface mismatch stays an EXPOSURE message without either being separate data.
//
// Layer direction is deliberately NOT here. `layerOrder` in the structural tier
// is the sole policy data and `placement/layer-direction` compares two indices
// against it; writing the derived result out again would create exactly the drift
// this module removes and would need a warning telling readers not to "fix" it.
//
// ─────────────────────────────────────────────────────────────────────────────

import {
  aliasSpecifierFor,
  classifySourcePath,
  classifyTargetPath,
  type FeatureLayerRole,
  isUnderPath,
  isUnitBarrel,
  orderedLayerDirs,
  type SourceProfile,
  type TargetArea,
  type TreeVocabulary,
  sharedUiDir,
} from "./layout.ts";

/**
 * What a cell grants. A surface rather than a boolean, so one table answers both
 * questions a boundary rule is ever asked: MAY this edge exist, and THROUGH WHAT.
 *
 *   deny                  no edge, in any spelling
 *   any                   the whole area, any depth
 *   barrel                the target unit's public surface and nothing past it
 *   barrel-or-ui-subtree  the barrel, or the unit's `ui/` directory
 *   { modules }           an explicit allowlist, relative to the target unit
 *
 * NEGATIVE SPACE: no cell in the shipped table below is a `{ modules }` surface,
 * and that is a fact about this layout rather than about the variant. The one
 * narrow allowlist the standard layout has — which infrastructure modules are
 * client-safe — belongs to `boundary/client-server-infra`, and restating it here
 * would be the second copy this whole module exists to remove. The variant ships
 * because the shape recurs the moment a project grants one module rather than an
 * area:
 *
 *   infrastructure: {
 *     modules: ["providers/query-client"],
 *     why: "The router mounts the query client because …",
 *   }
 */
export type ImportSurface =
  | "deny"
  | "any"
  | "barrel"
  | "barrel-or-ui-subtree"
  | { readonly modules: readonly string[]; readonly why: string };

/**
 * The whole policy. Exhaustive over both keys, so an unfilled cell is a compile
 * error — the property that turns an unguarded edge from an invisible hole into
 * something the typechecker refuses.
 *
 * `bun run typecheck` is what makes that promise observable in this repo rather
 * than only in an adopting one: both tsconfigs compile this file, so adding an
 * area or a profile fails here first. Do not re-assert the same completeness at
 * runtime — a hand-written list of the areas is a second copy that cannot see
 * the eleventh.
 *
 * SAME-UNIT EDGES NEVER REACH THIS TABLE. The evaluator recognises unit identity
 * first and returns `internal`: a feature barrel reaching its own layers, a
 * domain barrel re-exporting its own modules, one layer importing a sibling file.
 * That is why the `feature-barrel` row is `deny` across the board rather than
 * needing an "own only" value, and why there is no public relation enum.
 */
export const IMPORT_POLICY: Record<SourceProfile, Record<TargetArea, ImportSurface>> = {
  route: {
    route: "any",
    feature: "barrel-or-ui-subtree",
    domain: "deny",
    infrastructure: "any",
    shared: "any",
    "shared-ui": "any",
    "env-server": "deny",
    "env-client": "any",
    // Every member of this area a route could name is an entrypoint or the
    // generated route tree, and each of them reaches back down to the routes —
    // so the edge is a cycle through the file that mounts the app. The env
    // modules are their own areas and are decided two rows up; a stylesheet is
    // not a module edge and never reaches the table.
    //
    // NEGATIVE SPACE: this denies a TYPE import too, so
    // `import type { FileRouteTypes } from "@/routeTree.gen"` is denied from a
    // route. There is no type-only escape anywhere outside the `domain` row, and
    // that is the design rather than an oversight — a forbidden direction is
    // forbidden for a type because the coupling it creates is what the cell is
    // about, and the domain row is the one place where the runtime/type
    // distinction changes an ANSWER instead of just a build artifact. The cost
    // here is low: routes are written against typed `Link` and rarely name the
    // generated tree directly. A project that needs the escape adds a second
    // route profile or lifts the type into `shared/`, and does it once.
    "source-root": "deny",
    package: "any",
  },

  "feature-barrel": {
    route: "deny",
    feature: "deny",
    domain: "deny",
    infrastructure: "deny",
    shared: "deny",
    "shared-ui": "deny",
    "env-server": "deny",
    "env-client": "deny",
    "source-root": "deny",
    package: "deny",
  },

  "feature-root": {
    route: "deny",
    feature: "barrel",
    domain: "barrel",
    infrastructure: "deny",
    shared: "any",
    "shared-ui": "deny",
    "env-server": "deny",
    "env-client": "deny",
    "source-root": "deny",
    package: "any",
  },

  "feature-ui": {
    route: "deny",
    feature: "barrel",
    domain: "deny",
    infrastructure: "any",
    shared: "any",
    "shared-ui": "any",
    "env-server": "deny",
    "env-client": "any",
    "source-root": "deny",
    package: "any",
  },

  "feature-controllers": {
    route: "deny",
    feature: "barrel",
    domain: "barrel",
    infrastructure: "any",
    shared: "any",
    "shared-ui": "deny",
    "env-server": "any",
    "env-client": "any",
    "source-root": "deny",
    package: "any",
  },

  "feature-service": {
    route: "deny",
    feature: "barrel",
    domain: "barrel",
    infrastructure: "deny",
    shared: "any",
    "shared-ui": "deny",
    "env-server": "deny",
    "env-client": "deny",
    "source-root": "deny",
    package: "any",
  },

  "feature-repo": {
    route: "deny",
    feature: "deny",
    domain: "deny",
    infrastructure: "any",
    shared: "any",
    "shared-ui": "deny",
    "env-server": "deny",
    "env-client": "deny",
    "source-root": "deny",
    package: "any",
  },

  domain: {
    route: "deny",
    feature: "deny",
    domain: "barrel",
    infrastructure: "deny",
    shared: "any",
    "shared-ui": "deny",
    "env-server": "deny",
    "env-client": "deny",
    "source-root": "deny",
    package: "any",
  },

  infrastructure: {
    route: "deny",
    feature: "deny",
    domain: "deny",
    infrastructure: "any",
    shared: "any",
    "shared-ui": "deny",
    "env-server": "any",
    "env-client": "any",
    "source-root": "deny",
    package: "any",
  },

  shared: {
    route: "deny",
    feature: "deny",
    domain: "deny",
    infrastructure: "deny",
    shared: "any",
    "shared-ui": "deny",
    "env-server": "deny",
    "env-client": "any",
    "source-root": "deny",
    package: "any",
  },

  "shared-ui": {
    route: "deny",
    feature: "deny",
    domain: "deny",
    infrastructure: "deny",
    shared: "any",
    "shared-ui": "any",
    "env-server": "deny",
    "env-client": "any",
    "source-root": "deny",
    package: "any",
  },

  // NEGATIVE SPACE: one profile covers `client.tsx` and `server.ts` alike, so the
  // `env-server` cell below permits the BROWSER entrypoint to import server env
  // and the bundler is the only thing that stops it. That is a real gap and a
  // deliberate one: splitting this into a client-entry and a server-entry profile
  // needs a rule for telling them apart that is not "the filename", and a wrong
  // guess denies the server entrypoint its own config. A project that wants the
  // fence rather than the bundler adds the two profiles and decides both rows.
  "source-root": {
    route: "any",
    feature: "deny",
    domain: "deny",
    infrastructure: "any",
    shared: "any",
    "shared-ui": "any",
    "env-server": "any",
    "env-client": "any",
    "source-root": "any",
    package: "any",
  },
};

/**
 * The one flag on the whole engine, and it governs one row.
 *
 * A runtime import from a domain must land in one of these areas. Everything else
 * in that row is denied at runtime and evaluated by the table when type-only,
 * because a type import is erased and cannot make a verdict depend on anything.
 * This is the only profile where the runtime/type distinction changes an outcome,
 * so it is a flag on one row rather than an applicability framework. Every other profile applies to all imports.
 *
 * The two tiers mark `typeOnly` at different granularities, and both denials are
 * correct. The linter reads it per DECLARATION; the resolved graph reads it per
 * specifier string, so a module a domain imports both as `import type` and at
 * runtime is type-only in neither. A reader comparing the two diagnostics on one
 * line sees `deniedDirection` from the linter and `impureDomainRuntimeImport`
 * from the graph — one edge, two message ids, and the coarser reading is the
 * safe direction to be wrong in.
 *
 * `package` is deliberately absent, which is stricter than the table's
 * `domain → package: "any"` cell and is meant to be: the cell governs the type
 * import, this list governs the runtime one. A project that wants a genuinely
 * pure package (a date library, a decimal type) available to its domains adds
 * `"package"` here and gives up the distinction for all of them — there is no
 * per-package spelling, on purpose, because a per-package list is how the
 * exception grows until the layer stops being a domain layer.
 */
const DOMAIN_RUNTIME_AREAS: readonly TargetArea[] = ["domain", "shared"];

/** The profile the flag above governs. */
const RUNTIME_PURE_PROFILE: SourceProfile = "domain";
/**
 * How a diagnostic names each row, in the naming tree's own vocabulary.
 *
 * A function of the vocabulary rather than a constant record, because a label is
 * a PATH and a path is the thing a project renames. A frozen `"src/shared"` in a
 * message sent to a tree rooted at `packages/core` names a directory that is not
 * there, and the reader's first move is to go looking for it.
 */
export function profileLabel(vocabulary: TreeVocabulary, profile: SourceProfile): string {
  const alias = (path: string) => aliasSpecifierFor(vocabulary, path);
  const layer = (role: FeatureLayerRole) => `a feature's ${vocabulary.featureLayerDirs[role]}/ layer`;

  switch (profile) {
    case "route":
      return `a route in ${alias(vocabulary.routesDir)}`;
    case "feature-barrel":
      return "a feature barrel";
    case "feature-root":
      return "a file at a feature's root";
    case "feature-ui":
      return layer("ui");
    case "feature-controllers":
      return layer("controllers");
    case "feature-service":
      return layer("service");
    case "feature-repo":
      return layer("repo");
    case "domain":
      return "a domain";
    case "infrastructure":
      return alias(vocabulary.infrastructureDir);
    case "shared":
      return alias(vocabulary.sharedDir);
    case "shared-ui":
      return alias(sharedUiDir(vocabulary));
    case "source-root":
      return "a file in the source root";
  }
}

/** How a diagnostic names each column, in the naming tree's own vocabulary. */
export function areaLabel(vocabulary: TreeVocabulary, area: TargetArea): string {
  const alias = (path: string) => aliasSpecifierFor(vocabulary, path);

  switch (area) {
    case "route":
      return alias(vocabulary.routesDir);
    case "feature":
      return "a feature";
    case "domain":
      return "a domain";
    case "infrastructure":
      return alias(vocabulary.infrastructureDir);
    case "shared":
      return alias(vocabulary.sharedDir);
    case "shared-ui":
      return alias(sharedUiDir(vocabulary));
    case "env-server":
      return "the server env";
    case "env-client":
      return "the client env";
    case "source-root":
      return "the source root";
    case "package":
      return "a package";
  }
}

/**
 * Why each row is shaped the way it is — the prose the five deleted rules
 * carried, filed against the position it actually governs. A blocking diagnostic
 * that only states the rule is one people route around; the argument is what
 * makes the fix obvious, and the fix is almost always to MOVE the module rather
 * than to loosen the cell.
 *
 * Every directory this prose names is interpolated from the tree's vocabulary
 * for the same reason the labels are: a paragraph telling the reader to move
 * code into `domains/` is worth nothing in a tree that calls that directory
 * `core/`, and there is no way for the reader to tell that the sentence is stale
 * rather than that they are lost.
 */
export function profileRationale(vocabulary: TreeVocabulary, profile: SourceProfile): string {
  const alias = (path: string) => aliasSpecifierFor(vocabulary, path);
  const layers = vocabulary.featureLayerDirs;
  const domains = alias(vocabulary.domainsDir);
  const shared = alias(vocabulary.sharedDir);
  const sharedUi = alias(sharedUiDir(vocabulary));
  const infrastructure = alias(vocabulary.infrastructureDir);
  const routes = alias(vocabulary.routesDir);
  const barrel = `${vocabulary.clientBarrelModule}.ts`;

  switch (profile) {
    case "route":
      return `A route is a thin transport adapter: it composes feature UI and calls the feature's client-safe barrel. It is ISOMORPHIC — the same file runs on the server and ships to the browser — so a route that names the database, the server env or a domain has put server-only code, or business logic, in the one place that has to be safe in both. Reach it through the feature that owns it.`;

    case "feature-barrel":
      return `A barrel is a feature's public surface and nothing else: a short list of what the feature offers, re-exported from its own modules. An import here of anything OUTSIDE the feature makes the barrel a place code lives rather than a place it is announced, and every consumer of the feature silently takes the dependency on. Whatever this needs belongs in the layer that uses it — and if a consumer needs another unit's export, it should name that unit rather than receive it laundered through this one.`;

    case "feature-root":
      return `A file at a feature's root sits above every layer, so whatever it imports is imported by the whole feature. errors.ts is the one the recommended layout names, and error types are exactly the thing that must not drag a dependency in: an error that names an adapter cannot be thrown by a pure function, and an error that names the design system cannot be caught on the server. Take a domain's barrel and ${shared}; take anything else in the layer that needs it.`;

    case "feature-ui":
      return `A feature's ${layers.ui}/ renders. It does not reach up into the routes that mount it, and it does not reason: the ${layers.controllers}/ layer below it is where a call to the outside world is arranged and where a domain's answer is turned into something to display, which is what lets the component be read, and rendered, without the world in the right state.`;

    case "feature-controllers":
      return `${layers.controllers}/ is the feature's entry point and its widest licence: it may reach an adapter, the server env, a domain's barrel and another feature's barrel. What it may not do is reach UP into the routes that call it, which would make the feature unusable from any other route, or name a UI primitive, which is the layer above's decision.`;

    case "feature-service":
      return `${layers.service}/ is the feature's orchestration, and it is the layer that takes NOTHING from the outside: no adapter, no env, no database. Anything external arrives as a parameter from the ${layers.controllers}/ layer above. That is what makes a workflow testable by calling it, and it is why a ${layers.service}/ module reaching for infrastructure is almost always a ${layers.controllers}/ job that drifted downward.`;

    case "feature-repo":
      return `${layers.repo}/ is the feature's data access and a leaf: it talks to the database on the feature's behalf and reaches nothing else in the application. Connection and key material arrive from the layers above, which keeps every query runnable against any client — and a ${layers.repo}/ module that names another feature or a domain has stopped being data access and become a second ${layers.service}/.`;

    case "domain":
      return `${domains} holds business logic that is independent of delivery: same inputs, same answer, always. That is not housekeeping — a rule that reads env behaves differently between a local run and a shipped build, and a rule that queries behaves differently when the database is slow, so both make an answer depend on something other than the arguments. Neither looks like a failure, because the answer still arrives. Dependencies come in as parameters: the caller fetches, and the domain decides what the data MEANS.`;

    case "infrastructure":
      return `An adapter wraps one capability the outside world offers, and it faces DOWNWARD only. Reaching up into a feature, a domain or a route inverts the app: the wrapper stops being something a feature can be given and becomes something that knows what the app does with it, and neither can then be replaced on its own. It has no screen either, so the design system is not its to import.`;

    case "shared":
      return `Everything imports ${shared}, which is exactly why it may import nothing back: an edge out of here is reachable from any file in the app, so it is where cycles cost the most and show the least. The practical loss is portability — a helper that reaches into a feature stops being generic and becomes that feature's code filed in the wrong drawer. The fix is almost always to MOVE the module: if it needs a feature it belongs in that feature, if it needs an adapter it belongs in ${infrastructure}.`;

    case "shared-ui":
      return `The shared primitives in ${sharedUi} are the vocabulary every screen is written in, so anything they depend on becomes a dependency of the entire app's UI. A primitive that reads the server env, or knows what an invoice is, cannot be used on the screen that has neither — and the next screen that needs it writes a second one. It also keeps the layer honest about what it decides: a component here settles presentation, and the moment it also settles where data comes from it has taken a decision that belongs to the screen, for every screen at once.`;

    case "source-root":
      return `The files directly in the source root are the composition root: the env modules, the router, the client and server entrypoints. They wire the app together, which is why they may name almost anything below them — and why they may not name a feature or a domain. Wiring that knows which features exist is an app that cannot add one without editing its own boot sequence; the router reaches features through the route tree, which is generated. A feature's public surface is its ${barrel}, and ${routes} is what mounts it.`;
  }
}

/**
 * Every diagnostic this policy can raise, as a template. One id per invariant, so
 * failures stay greppable and testable even though configuration is all-or-nothing
 * on a single oxlint rule id.
 *
 * The oxlint tier spreads these straight into `meta.messages` and lets oxlint
 * interpolate; the structural tier renders them with `renderPolicyMessage`. One
 * copy of the prose, two surfaces — which is the whole point of this module.
 *
 * Every directory a template would otherwise name arrives as DATA, not as text.
 * oxlint's `meta.messages` are static strings, so a message that spelled
 * `features/<name>/<layer>` inline could not follow a tree that renames either —
 * `{{areas}}` is that list, built from the vocabulary of the tree the file was
 * resolved into.
 */
export const POLICY_MESSAGES = {
  unclassifiedSource:
    "{{path}} sits inside a declared tree and matches no part of the architecture, so no import policy applies to it — nothing this file imports is checked, and nothing reports that. Either move it into an area that exists ({{areas}}) or, if this really is a new area, give it a SourceProfile in lint/policy/layout.ts and fill in its row in lint/policy/import-policy.ts. Filling the row is the point: an area with no policy is one nobody decided.",

  unclassifiedTarget:
    '"{{specifier}}" resolves to {{target}}, which is in no known area. A directory inside a declared tree that no TargetArea claims is an unpoliced destination: every rule about what may import it is vacuous, in both directions. Add it to lint/policy/layout.ts and to every row of the table in lint/policy/import-policy.ts, which is where deciding it happens.',

  deniedDirection:
    '{{profile}} may not import {{area}} — "{{specifier}}" lands in {{target}}. {{rationale}}',

  deniedExposure:
    '{{profile}} may import {{area}} only through {{requirement}}, and "{{specifier}}" reaches {{target}}. {{rationale}}',

  impureDomainRuntimeImport:
    'A domain took a runtime dependency on {{area}} — "{{specifier}}". {{rationale}} A domain may runtime-import another domain, its own siblings and the shared tree, and nothing else; naming a TYPE from anywhere is free, because a type import is erased and cannot change what an answer depends on. A package is not exempt for being small: a schema library reaches no network, but a schema living in the domain is the domain deciding how a payload is PARSED, which is a boundary decision.',

  crossingSpelledRelatively:
    '"{{specifier}}" leaves {{fromUnit}} and lands in {{toUnit}}. Write it as "{{canonical}}" instead. The policy allows this edge; what it does not allow is hiding it — the relative spelling of a crossing is the form the specifier-matching tier cannot see, so a rule that governs the aliased path governs nothing here. Relative imports stay correct INSIDE one unit: they cross nothing, and this reports none of them. The alias is the spelling, not a promise — the same edge is still judged by the same table.',
} as const;

export type PolicyMessageId = keyof typeof POLICY_MESSAGES;

/**
 * The areas a file could be moved INTO, spelled the way this tree spells them.
 * The `unclassifiedSource` message's whole job is to name a destination, and a
 * refusal with no destination is what gets a blocking rule switched off.
 */
export function describeKnownAreas(vocabulary: TreeVocabulary): string {
  const layers = orderedLayerDirs(vocabulary).join("|");
  return [
    vocabulary.routesDir,
    `${vocabulary.featuresDir}/<name>/(${layers})`,
    `${vocabulary.featuresDir}/<name>/${vocabulary.clientBarrelModule}.ts`,
    `${vocabulary.domainsDir}/<name>`,
    vocabulary.infrastructureDir,
    vocabulary.sharedDir,
    sharedUiDir(vocabulary),
    "or the source root itself",
  ].join(", ");
}

/**
 * What the evaluator decides about one edge.
 *
 * `internal` reports nothing. `deny` is the semantic denial, reported by whichever
 * tier saw the edge. `allow-crossing` means the edge is permitted AND leaves its
 * unit — the structural tier turns that into the alias-spelling diagnostic, and
 * the oxlint tier ignores it, because a specifier it can read is already spelled
 * the canonical way or is a package with no other spelling.
 */
export type PolicyVerdict =
  | { kind: "internal" }
  | { kind: "deny"; messageId: PolicyMessageId; data: Record<string, string> }
  | { kind: "allow-crossing"; canonicalSpecifier: string };

/** What an import names, in the one currency both tiers can produce. */
export type ImportTarget = { kind: "module"; path: string } | { kind: "package"; name: string };

export type PolicyInput = {
  /** The vocabulary of the declared tree the importing file was resolved into. */
  vocabulary: TreeVocabulary;
  /** The importing file's path from that tree's source root. Extension optional. */
  sourcePath: string;
  target: ImportTarget;
  /** As written. For the message only — never matched on. */
  specifier: string;
  /** True when the import is erased at build time and creates no runtime edge. */
  typeOnly: boolean;
};

/**
 * Classify, recognise unit identity, look up one cell, check the surface.
 *
 * The order is the design. Unit identity comes FIRST because a feature reaching
 * its own layers is not a policy question at all — `placement/layer-direction`
 * and `boundary/layer-occupancy` answer that one, and running it through the
 * table would make "barrel only, always" break a barrel against itself.
 *
 * Both ends are read in ONE tree's vocabulary, and that is a real restriction
 * rather than an oversight: a specifier is resolved against the importing file's
 * tree, so an edge whose target lands outside that tree resolves to no area and
 * is not this table's question. Cross-TREE policy is not stated anywhere in this
 * catalog — see the negative space in `declared-trees.ts`.
 */
export function evaluateImportPolicy(input: PolicyInput): PolicyVerdict {
  const { vocabulary, sourcePath, target, specifier, typeOnly } = input;

  const from = classifySourcePath(vocabulary, sourcePath);
  if (from === undefined) {
    return {
      kind: "deny",
      messageId: "unclassifiedSource",
      data: { path: sourcePath, areas: describeKnownAreas(vocabulary) },
    };
  }

  const to =
    target.kind === "package"
      ? { area: "package" as TargetArea, unit: target.name, path: target.name }
      : classifyTargetPath(vocabulary, target.path);

  if (to === undefined) {
    return {
      kind: "deny",
      messageId: "unclassifiedTarget",
      data: { specifier, target: target.kind === "module" ? target.path : target.name },
    };
  }

  if (target.kind === "module" && to.unit === from.unit) return { kind: "internal" };

  const shared = {
    profile: profileLabel(vocabulary, from.profile),
    area: areaLabel(vocabulary, to.area),
    specifier,
    target: to.path,
    rationale: profileRationale(vocabulary, from.profile),
  };

  if (
    from.profile === RUNTIME_PURE_PROFILE &&
    !typeOnly &&
    !DOMAIN_RUNTIME_AREAS.includes(to.area)
  ) {
    return { kind: "deny", messageId: "impureDomainRuntimeImport", data: shared };
  }

  const surface = IMPORT_POLICY[from.profile][to.area];
  if (surface === "deny") {
    return { kind: "deny", messageId: "deniedDirection", data: shared };
  }

  if (!surfaceAdmits(vocabulary, surface, to.unit, to.path)) {
    return {
      kind: "deny",
      messageId: "deniedExposure",
      data: {
        ...shared,
        requirement: describeSurface(vocabulary, surface, to.unit),
        rationale: surfaceRationale(vocabulary, surface),
      },
    };
  }

  // A package has no relative spelling and therefore no canonical alias to
  // propose; it is still a crossing, and the caller that cannot see relative
  // edges is the only one that ever receives it.
  return {
    kind: "allow-crossing",
    canonicalSpecifier:
      target.kind === "package" ? specifier : aliasSpecifierFor(vocabulary, to.path),
  };
}

/** Renders a template for the tier that does not get oxlint's interpolation. */
export function renderPolicyMessage(
  messageId: PolicyMessageId,
  data: Record<string, string>,
): string {
  return POLICY_MESSAGES[messageId].replace(
    /\{\{(\w+)\}\}/g,
    (whole, key: string) => data[key] ?? whole,
  );
}

/**
 * `deny` is excluded from the parameter rather than handled and ignored: the
 * caller has already returned on it, and a branch here for a case that cannot
 * arrive is a code path with no subject.
 */
type GrantingSurface = Exclude<ImportSurface, "deny">;

function surfaceAdmits(
  vocabulary: TreeVocabulary,
  surface: GrantingSurface,
  unit: string,
  path: string,
): boolean {
  if (surface === "any") return true;
  if (surface === "barrel") return isUnitBarrel(vocabulary, unit, path);
  if (surface === "barrel-or-ui-subtree") {
    const uiLayer = `${unit}/${vocabulary.featureLayerDirs.ui}`;
    return isUnitBarrel(vocabulary, unit, path) || isUnderPath(path, uiLayer);
  }
  return surface.modules.includes(relativeToUnit(unit, path));
}

function describeSurface(
  vocabulary: TreeVocabulary,
  surface: GrantingSurface,
  unit: string,
): string {
  const client = aliasSpecifierFor(vocabulary, unit);
  const server = aliasSpecifierFor(vocabulary, `${unit}/${vocabulary.serverBarrelModule}`);
  if (surface === "barrel") return `its barrels, ${client} and ${server}`;
  if (surface === "barrel-or-ui-subtree") {
    return `its barrels ${client} and ${server}, or its ${vocabulary.featureLayerDirs.ui}/ directory`;
  }
  if (surface === "any") return "any module";
  const allowed = surface.modules.map((module) =>
    aliasSpecifierFor(vocabulary, `${unit}/${module}`),
  );
  return allowed.join(" and ");
}

function surfaceRationale(vocabulary: TreeVocabulary, surface: GrantingSurface): string {
  if (surface === "barrel") {
    return `The barrel is that unit's whole public surface, and its internal layout is not a contract anyone agreed to. What a barrel buys is the freedom to move things: rename ${vocabulary.featureLayerDirs.service}/ to usecases/, split a ${vocabulary.featureLayerDirs.controllers}/ module, fold a ${vocabulary.featureLayerDirs.repo}/ into the ${vocabulary.featureLayerDirs.service}/ it only ever served — with a barrel all of that is one file's diff, and without it the internal layout IS the API. If what you need is not exported there, add it to that ${vocabulary.clientBarrelModule}.ts, which is also the moment to ask whether the two units are really separate. Which of the two barrels YOU may name is api/server-import-context's answer, not this one's.`;
  }
  if (surface === "barrel-or-ui-subtree") {
    return `The ${vocabulary.featureLayerDirs.ui}/ exception exists because a route COMPOSES components, and routing every one through the barrel would turn it into a re-export list that grows forever and says nothing. It is ${vocabulary.featureLayerDirs.ui}/ and only ${vocabulary.featureLayerDirs.ui}/: ${orderedLayerDirs(vocabulary).slice(1).join("/, ")}/ have no such excuse, and data comes through the barrel. If the barrel is missing what you need, export it there.`;
  }
  if (surface === "any") return "";
  return surface.why;
}

function relativeToUnit(unit: string, path: string): string {
  return path.startsWith(`${unit}/`) ? path.slice(unit.length + 1) : path;
}
