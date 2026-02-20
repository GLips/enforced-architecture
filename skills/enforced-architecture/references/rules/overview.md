# Rule Catalog

Complete index of enforcement rules. Each rule has a template in its tag directory — read the template for full documentation, adaptation guidance, and implementation details.

## How to Use This Catalog

1. **During Phase 3 (rule design):** Scan this table to select rules that apply to the project.
2. **During Phase 4 (implementation):** Read each selected rule's template file, adapt it to the project's directory structure and import patterns, and write the adapted rule into the project.
3. **GritQL rules** (`.grit` files) go into the project's `biome/` directory with `<tag>-<name>.grit` naming.
4. **Structural scripts** (`.md` descriptions) are implemented as Bun TypeScript scripts in the project's `scripts/` directory.

## Rule Index

### boundary — Layer direction and import restrictions

| Rule | Mechanism | Blocking | What it prevents |
|---|---|---|---|
| [boundary/db-isolation](boundary/db-isolation.grit) | GritQL | Yes | Code outside data-access layers importing DB modules directly |
| [boundary/domain-purity](boundary/domain-purity.grit) | GritQL | Yes | Domains importing infrastructure, features, routes, or env |
| [boundary/route-thinness](boundary/route-thinness.grit) | GritQL | Yes | Routes importing DB, raw SDKs, or infrastructure internals |
| [boundary/shared-ui-purity](boundary/shared-ui-purity.grit) | GritQL | Yes | Shared UI gaining feature, domain, or infrastructure dependencies |
| [boundary/shared-purity](boundary/shared-purity.grit) | GritQL | Yes | Shared utilities importing app modules (features, domains, etc.) |
| [boundary/sdk-containment](boundary/sdk-containment.grit) | GritQL | Yes | Direct SDK imports outside designated infrastructure wrappers |
| [boundary/client-server-infra](boundary/client-server-infra.grit) | GritQL | Yes | Client contexts importing server-only infrastructure modules |
| [boundary/cross-boundary-alias](boundary/cross-boundary-alias.grit) | GritQL | Yes | Relative imports that cross top-level directory or feature boundaries |
| [boundary/server-no-upward](boundary/server-no-upward.grit) | GritQL | Yes | Controllers/server code importing from UI or route layers |
| [boundary/no-test-imports](boundary/no-test-imports.grit) | GritQL | Yes | Production code importing from test files |
| [boundary/layer-occupancy](boundary/layer-occupancy.md) | Script | Yes | Bypassing present layers (e.g., controllers importing DB when repo/ exists) |

### api — Public API surface and barrel conventions

| Rule | Mechanism | Blocking | What it prevents |
|---|---|---|---|
| [api/domain-public-api](api/domain-public-api.grit) | GritQL | Yes | External code importing domain internals (deep imports past barrel) |
| [api/feature-public-api](api/feature-public-api.grit) | GritQL | Yes | External code importing feature internals (deep imports past barrel) |
| [api/barrel-direction](api/barrel-direction.grit) | GritQL | Yes | `index.ts` importing from `server.ts` (must never reverse) |
| [api/server-import-context](api/server-import-context.grit) | GritQL | Yes | Non-server contexts importing `*/server` barrels |
| [api/barrel-purity](api/barrel-purity.md) | Script | Yes | Client-safe barrels transitively pulling in server-only packages |

### structure — File placement and naming

| Rule | Mechanism | Blocking | What it prevents |
|---|---|---|---|
| [structure/server-fn-placement](structure/server-fn-placement.grit) | GritQL | Yes | `createServerFn` outside `controllers/` directories |
| [structure/layer-direction](structure/layer-direction.grit) | GritQL | Yes | Within-feature layer import direction violations (e.g., repo importing controllers) |
| [structure/deprecated-paths](structure/deprecated-paths.grit) | GritQL | Yes | Imports from removed/renamed paths (e.g., `@/components/*`) |
| [structure/schema-placement](structure/schema-placement.grit) | GritQL | Yes | Drizzle schema declarations (`pgTable`, `relations`) outside `infrastructure/db/schema/` |
| [structure/server-fn-validation](structure/server-fn-validation.grit) | GritQL | Yes | `createServerFn` chaining `.handler()` without `.validator()` |

### graph — Cross-file dependency analysis

| Rule | Mechanism | Blocking | What it prevents |
|---|---|---|---|
| [graph/domain-cycles](graph/domain-cycles.md) | Script | Yes | Circular dependencies between domains |
| [graph/feature-deps](graph/feature-deps.md) | Script | Mixed | Cycles: hard fail. Coupling thresholds (edge count, pair saturation, fan-out): warnings |

### health — Code quality metrics

| Rule | Mechanism | Blocking | What it prevents |
|---|---|---|---|
| [health/file-size](health/file-size.md) | Script | Mixed | Files exceeding line count thresholds (project-configurable warn + fail) |
| [health/trampolines](health/trampolines.md) | Script | No | Pass-through wrapper functions that add no behavior |

### react — React code smell detection

| Rule | Mechanism | Blocking | What it prevents |
|---|---|---|---|
| [react/derived-state](react/derived-state.grit) | GritQL | Yes | `useState` + `useEffect` for values that should be computed inline or with `useMemo` |
| [react/no-direct-fetch](react/no-direct-fetch.grit) | GritQL | Yes | `fetch()` calls in `.tsx` component files (use server functions or TanStack Query) |
| [react/single-component-export](react/single-component-export.grit) | GritQL | Yes | Multiple exported React components in one file (compound components via `Object.assign` are fine) |
| [react/no-nested-ternary-jsx](react/no-nested-ternary-jsx.grit) | GritQL | Yes | Double-nested ternary expressions in JSX (extract to variables or components) |
| [react/hook-count](react/hook-count.md) | Script | No | Components with 7+ hook calls (doing too much, extract custom hook) |
| [react/prop-count](react/prop-count.md) | Script | No | Components with 8+ props (needs decomposition or context) |

## Selecting Rules

Not every project needs every rule. Use audit findings to guide selection:

| If the project has... | Include these rules |
|---|---|
| Database layer | `boundary/db-isolation`, `structure/schema-placement` |
| `domains/` directory | `boundary/domain-purity`, `api/domain-public-api`, `graph/domain-cycles` |
| Multiple features | `api/feature-public-api`, `graph/feature-deps` |
| SSR / bundle splitting | `api/barrel-direction`, `api/barrel-purity`, `api/server-import-context`, `boundary/client-server-infra` |
| `createServerFn` usage | `structure/server-fn-placement`, `structure/server-fn-validation` |
| Intra-feature layers | `structure/layer-direction`, `boundary/layer-occupancy`, `boundary/server-no-upward` |
| React UI | All `react/` rules |
| External SDK integrations | `boundary/sdk-containment` |
| Any TypeScript project | `boundary/cross-boundary-alias`, `boundary/no-test-imports`, `boundary/shared-purity`, `health/file-size` |
