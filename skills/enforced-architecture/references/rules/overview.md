# Rule Catalog

Complete index of enforcement rules. Each rule has a template in its tag directory — read the template for full documentation, adaptation guidance, and implementation details.

## How to Use This Catalog

1. **During Phase 3 (rule design):** Scan this table to select rules that apply to the project.
2. **During Phase 4 (implementation):** Read each selected rule's template file, adapt it to the project's directory structure and import patterns, and write the adapted rule into the project.
3. **oxlint rules** (`.ts` files) go into the project's `oxlint/rules/` directory, are registered in its `oxlint/plugin.ts`, and are switched on in `.oxlintrc.json`. Each rule's spec (`<name>.test.ts`) is copied beside it — it is part of the rule, not an optional extra.
4. **Structural scripts** (`.md` descriptions) are implemented as Bun TypeScript functions behind one orchestrator in the project's `scripts/` directory, sharing a `lib.ts`.
5. **Build [graph/import-graph](graph/import-graph.md) before its consumers.** Six rules answer *where an import lands* rather than *how it is spelled*, and they are the ones that break silently when they don't.
6. **Every rule ships with its specs**, including one adversarial case — see *Rule Specs* in [enforcement-implementation.md](../enforcement-implementation.md).

## What Is Verified Before It Reaches You

The **Mechanism** column below is also the coverage line, and it is worth reading that way before you trust a template.

- **oxlint** templates are runnable code, and every one of them is proved in this repo's CI against three kinds of case — the obvious violation, the adversarial spelling, and the legal neighbour that must stay silent. A template edit that breaks a rule fails the pull request. The specs ship *beside* the rules, so a project stealing a rule steals its tests in the same copy; the runner that enforces the three-kind contract lives in `harness/` beside `skills/` in the skill's source repository and does not ship with the skill directory.
- **Script** templates are **not spec-tested here**. Nearly all of them describe an algorithm rather than shipping code, so there is nothing to load and nothing to run. Their correctness is established in the consuming project, by the fixtures that project writes alongside its implementation — which is not a lesser bar, but it *is* a later one, and until then a script template is an untested design. `api/feature-visibility` is the one that ships as running code, and the exception buys less than it looks: it still has no fixtures here, and it still has to be pointed at the project's shared library before it does anything.

What the harness does not cover for either kind: whether a template survives **adaptation**. Repointing a path pattern, extending a package list, or adding an exclusion is unverified work. Write the project's own specs at the same time as the adaptation, not after.

## Rule Index

### boundary — Layer direction and import restrictions

| Rule | Mechanism | Blocking | What it prevents |
|---|---|---|---|
| [boundary/db-isolation](boundary/db-isolation.ts) | oxlint | Yes | Code outside data-access layers importing DB modules directly |
| [boundary/domain-purity](boundary/domain-purity.ts) | oxlint | Yes | Domains using aliased or package runtime imports outside domains and shared |
| [boundary/route-thinness](boundary/route-thinness.ts) | oxlint | Yes | Routes importing DB, raw SDKs, or infrastructure internals |
| [boundary/shared-ui-purity](boundary/shared-ui-purity.ts) | oxlint | Yes | Shared UI gaining feature, domain, or infrastructure dependencies |
| [boundary/shared-purity](boundary/shared-purity.ts) | oxlint | Yes | Shared utilities importing app modules (features, domains, etc.) |
| [boundary/sdk-containment](boundary/sdk-containment.ts) | oxlint | Yes | Direct SDK imports outside designated infrastructure wrappers |
| [boundary/client-server-infra](boundary/client-server-infra.ts) | oxlint | Yes | Client contexts importing server-only infrastructure modules |
| [boundary/cross-boundary-alias](graph/import-graph.md) | Script | Yes | Relative imports that cross a boundary — a bypass for every rule that matches the aliased path. Consumes the import graph |
| [boundary/server-no-upward](boundary/server-no-upward.ts) | oxlint | Yes | Controllers/server code importing from UI or route layers |
| [boundary/no-test-imports](boundary/no-test-imports.ts) | oxlint | Yes | Production code importing from test files |
| [boundary/layer-occupancy](boundary/layer-occupancy.md) | Script | Yes | Bypassing present layers (e.g., controllers importing schema when repo/ exists, or importing repo when service/ exists) |
| [boundary/env-access](boundary/env-access.ts) | oxlint | Yes | Any module but the env module reading `process.env` directly |

### api — Public API surface and barrel conventions

| Rule | Mechanism | Blocking | What it prevents |
|---|---|---|---|
| [api/domain-public-api](api/domain-public-api.ts) | oxlint | Yes | External code importing domain internals (deep imports past barrel) |
| [api/feature-public-api](api/feature-public-api.ts) | oxlint | Yes | External code importing feature internals (deep imports past barrel) |
| [api/barrel-direction](api/barrel-direction.ts) | oxlint | Yes | `index.ts` importing from `index.server.ts` (must never reverse) |
| [api/server-import-context](api/server-import-context.ts) | oxlint | Yes | Non-server contexts importing `*/index.server` barrels |
| [api/barrel-purity](api/barrel-purity.md) | Script | Yes | Client-safe barrels transitively pulling in server-only packages |
| [api/feature-visibility](api/feature-visibility.md) | Script | Mixed | Cross-feature imports the importee never granted. Ungranted edges block, stale grants warn. Consumes the import graph |

### structure — File placement and naming

| Rule | Mechanism | Blocking | What it prevents |
|---|---|---|---|
| [structure/server-fn-placement](structure/server-fn-placement.ts) | oxlint | Yes | `createServerFn` outside `controllers/` directories |
| [structure/no-deprecated-input-validator](structure/no-deprecated-input-validator.ts) | oxlint | Yes | Deprecated `.inputValidator()` calls on TanStack Start server functions and middleware |
| [structure/no-plain-export-in-server-fn-module](structure/no-plain-export-in-server-fn-module.ts) | oxlint | Yes | Runtime exports other than `createServerFn` and `createMiddleware` bridges in compiler-processed modules |
| [structure/layer-direction](graph/import-graph.md) | Script | Yes | Within-feature layer direction violations (e.g., repo importing controllers), at any nesting depth and in either spelling. Consumes the import graph |
| [structure/topology](structure/topology.md) | Script | Yes | Files living where no rule looks — unlisted `src/` roots, modules at a feature root, routes reaching into infrastructure |
| [structure/deprecated-paths](structure/deprecated-paths.ts) | oxlint | Yes | Imports from removed/renamed paths (e.g., `@/components/*`) |
| [structure/schema-placement](structure/schema-placement.ts) | oxlint | Yes | Drizzle schema declarations (`pgTable`, `relations`) outside `infrastructure/db/schema/` |
| [structure/server-fn-validation](structure/server-fn-validation.ts) | oxlint | Yes | `createServerFn` chaining `.handler()` without `.validator()` |
| [structure/no-raw-result](structure/no-raw-result.ts) | oxlint | Yes | Returning unserializable Drizzle write results (`db.delete`, `.onConflictDoNothing`) without `.returning()` |

### graph — Cross-file dependency analysis

| Rule | Mechanism | Blocking | What it prevents |
|---|---|---|---|
| [graph/import-graph](graph/import-graph.md) | Script | — | Not a rule: the resolved import graph five rules consume instead of matching import strings. Build it first |
| [graph/domain-cycles](graph/domain-cycles.md) | Script | Yes | Circular dependencies between domains |
| [graph/feature-deps](graph/feature-deps.md) | Script | Mixed | Cycles: hard fail. Coupling thresholds (edge count, pair saturation, fan-out): warnings |

### health — Code quality metrics

| Rule | Mechanism | Blocking | What it prevents |
|---|---|---|---|
| [health/file-size](health/file-size.md) | Script | Mixed | Files exceeding line count thresholds (project-configurable warn + fail) |
| [health/no-nested-ternary](health/no-nested-ternary.ts) | oxlint | Yes | Ternary expressions nested 3+ levels deep (extract to variables or helpers) |
| [health/trampolines](health/trampolines.md) | Script | No | Pass-through wrapper functions that add no behavior |

### naming — Searchability and discoverability

Agents navigate this codebase by grepping symbol names more than by tracing imports or types, so names are the primary index. These rules keep the public surface visible to plain text. (Name *quality* — specific, domain-laden export names and consistent terminology — is a judgment call left to CLAUDE.md guidance, not mechanically enforced.)

| Rule | Mechanism | Blocking | What it prevents |
|---|---|---|---|
| [naming/barrel-discoverability](naming/barrel-discoverability.md) | Script | Yes | Public barrels using `export *` or renamed re-exports (`export { X as Y }`) that hide or rename symbols from text search |
| [naming/test-file-mirror](naming/test-file-mirror.md) | Script | No | Test files whose names don't mirror their source, so they don't surface alongside the code they cover |

### style — Design-system adherence

Styling is where generated code drifts hardest and least visibly. A model reaches for a plausible gray, a raw `fontSize`, a `16px` where `"md"` was meant — each one defensible on its own, none of them canonically yours, and across enough generations the interface quietly stops matching itself. A design doc does not stop this: anything written in prose is a probability the model weighs against everything else in its context, not a guarantee. These rules make off-system styling *hard to express* rather than discouraged.

Enforcement runs in three tiers, and picking the right one per axis is most of the work:

1. **Types** — closed props on your own primitives (a `tone`, not an open `color`; a `size` from a small union). The wrong value does not compile. This is the strongest tier and the cheapest; put every axis here that will fit. It is also the answer for "the variant value must come from the token union" — that is a type-system job, not a lint job.
2. **oxlint rules** — the escape hatches types leave open (component libraries that also accept any string, inline style objects, `className`). Per-file, real-time, JS/TS AST only.
3. **Structural scripts** — anything needing the token source, cross-file knowledge, or the CSS surface, none of which a per-file JS/TS rule can reach.

| Rule | Mechanism | Blocking | What it prevents |
|---|---|---|---|
| [style/no-raw-primitives](style/no-raw-primitives.ts) | oxlint | Yes | Feature code using raw `<div>`/`<span>` (web) or `View`/`Text` from `react-native`, instead of composing the design system's primitives |
| [style/no-inline-color](style/no-inline-color.ts) | oxlint | Yes | Raw hex / `rgb()` / `hsl()` values in style objects and color props (breaks light/dark, which tokens hold together) |
| [style/no-inline-font-size](style/no-inline-font-size.ts) | oxlint | Yes | Raw `fontSize` overrides instead of a named size from the type scale |
| [style/no-inline-style-prop](style/no-inline-style-prop.ts) | oxlint | Yes | Inline `style={{…}}` objects outside the primitives layer (strictest rule in the tag — see its Adapt section before taking it) |
| [style/no-arbitrary-class-values](style/no-arbitrary-class-values.ts) | oxlint | Yes | Utility classes carrying raw values (`text-[13px]`, `bg-[#fff]`) or the framework's generic scale (`text-sm`) instead of semantic tokens |
| [style/vendor-component-containment](style/vendor-component-containment.ts) | oxlint | Yes | Importing a UI-library component directly when the project ships a wrapper that carries a shared convention |
| [style/token-equality](style/token-equality.md) | Script | Yes | Raw values that exactly equal a named token (`gap={16}` when that IS `"md"`). Off-scale one-offs pass deliberately |
| [style/css-tokens](style/css-tokens.md) | Script | Yes | Raw color and font-size in stylesheets — the surface a JS/TS lint rule cannot see |
| [style/shadow-source](style/shadow-source.md) | Script | Yes | `box-shadow` / elevation outside the one curated shadow file |

### react — React code smell detection

| Rule | Mechanism | Blocking | What it prevents |
|---|---|---|---|
| [react/derived-state](react/derived-state.ts) | oxlint | Yes | `useState` + `useEffect` for values that should be computed inline or with `useMemo` |
| [react/no-direct-fetch](react/no-direct-fetch.ts) | oxlint | Yes | `fetch()` calls in `.tsx` component files (use server functions or TanStack Query) |
| [react/single-component-export](react/single-component-export.md) | Script | No | Multiple exported React components in one file (compound components via `Object.assign` are fine) |
| [react/no-async-effect](react/no-async-effect.ts) | oxlint | Yes | Async operations in useEffect without cleanup, or async useCallback (typically called from effects without cleanup) |
| [react/hook-count](react/hook-count.md) | Script | No | Components with 7+ hook calls (doing too much, extract custom hook) |
| [react/prop-count](react/prop-count.md) | Script | No | Components with 8+ props (needs decomposition or context) |

## Selecting Rules

Not every project needs every rule. Use audit findings to guide selection:

| If the project has... | Include these rules |
|---|---|
| Database layer | `boundary/db-isolation`, `structure/schema-placement`, `structure/no-raw-result` |
| `domains/` directory | `boundary/domain-purity`, `api/domain-public-api`, `graph/domain-cycles` |
| Multiple features | `api/feature-public-api`, `graph/feature-deps` |
| Multiple features **and** agents writing most of the code | `api/feature-visibility` — pair-wise opt-in on top of the above |
| SSR / bundle splitting | `api/barrel-direction`, `api/barrel-purity`, `api/server-import-context`, `boundary/client-server-infra` |
| `createServerFn` or `createMiddleware` usage | `structure/server-fn-placement` and `structure/server-fn-validation` for server functions; `structure/no-deprecated-input-validator` and `structure/no-plain-export-in-server-fn-module` for both |
| Intra-feature layers | `graph/import-graph`, `structure/layer-direction`, `boundary/layer-occupancy`, `boundary/server-no-upward` |
| React UI | All `react/` rules (including `no-async-effect` if using TanStack Query or similar) |
| A design system / component library | `style/no-raw-primitives`, `style/no-inline-color`, `style/no-inline-font-size`, `style/token-equality`, `style/shadow-source` |
| Stylesheets (`.css`, CSS modules) | `style/css-tokens` |
| Utility CSS (Tailwind or similar) | `style/no-arbitrary-class-values` |
| A stylesheet layer inline styles would bypass (Unistyles, StyleX, vanilla-extract) | `style/no-inline-style-prop` |
| Wrapped UI-library components | `style/vendor-component-containment` |
| External SDK integrations | `boundary/sdk-containment` |
| Public barrels (two-barrel API) | `naming/barrel-discoverability` |
| Co-located tests | `naming/test-file-mirror` |
| Any TypeScript project | `graph/import-graph`, `boundary/cross-boundary-alias`, `boundary/env-access`, `boundary/no-test-imports`, `boundary/shared-purity`, `structure/topology`, `health/file-size`, `health/no-nested-ternary` |
