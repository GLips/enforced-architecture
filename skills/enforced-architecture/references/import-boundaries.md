# Import Boundaries

Definitive source of truth for "can module A import module B?" Every cell in every matrix is an explicit decision. When a cell says NO, the import is denied and enforced mechanically. When in doubt, the answer is NO. Relaxing a restriction later is trivial; tightening one after violations have been copied as patterns is expensive.

This reference covers the recommended setup: domains layer present, features with layered subdirectories (`controllers/`, `service/`, `repo/`, `ui/`). For simplified setups (no domains, flat features), remove the domains row/column and collapse the feature sub-rows.

---

## Import Boundary Matrix

Read as: "Can `{row}` import from `{column}`?"

| Source ↓ imports Target → | `infrastructure/db/` | `infrastructure/*` | `features/` | `domains/` | `shared/` | `shared/ui/` | `routes/` | `env.server` | `env.client` |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **`infrastructure/db/`** | self | NO | NO | NO | YES | NO | NO | `client.ts` only | NO |
| **`infrastructure/*`** | designated files | self | NO | NO | YES | NO | NO | YES | YES |
| **`features/*/controllers/`** | via repo (if exists) | YES | public API only | YES | YES | NO | NO | YES | YES |
| **`features/*/service/`** | NO | NO | public API only | YES | YES | NO | NO | NO | NO |
| **`features/*/repo/`** | YES | YES | NO | NO | YES | NO | NO | NO | NO |
| **`features/*/ui/`** | NO | NO | own controllers, other features' public API | NO | YES | YES | NO | NO | YES |
| **`domains/*`** | NO | NO | NO | self (no cycles) | YES | NO | NO | NO | NO |
| **`shared/*`** | NO | NO | NO | NO | self | --- | NO | NO | YES |
| **`shared/ui/*`** | NO | NO | NO | NO | YES | self | NO | NO | YES |
| **`routes/*`** | NO | YES (limited) | YES (public API + ui) | NO | YES | YES | self | NO | YES |

### Cell-by-Cell Explanation

#### `infrastructure/db/`

- **self**: Internal imports within `infrastructure/db/` are unrestricted. Schema files import from each other, `client.ts` imports config, etc.
- **`infrastructure/*`**: NO. The DB module is a standalone concern. It does not import auth, integrations, telemetry, or other infrastructure adapters. Other infrastructure modules import from DB, not the reverse.
- **`features/`**: NO. Infrastructure never imports from features. The dependency arrow points the other direction.
- **`domains/`**: NO. Infrastructure never imports from domains.
- **`shared/`**: YES. DB modules may use shared utilities (e.g., type helpers, constants).
- **`shared/ui/`**: NO. DB code has no reason to import UI components.
- **`routes/`**: NO. Infrastructure never imports from routes.
- **`env.server`**: `client.ts` only. The DB client file reads database connection config from `env.server.ts`. No other DB files import env directly.
- **`env.client`**: NO. DB code runs server-side only; client env has no relevant config.

#### `infrastructure/*` (non-DB)

- **`infrastructure/db/`**: Designated files only. Auth infrastructure imports from `infrastructure/db/client` and `infrastructure/db/schema` to interact with auth tables. Integration adapters generally do not import DB. Each infrastructure module accesses only the DB files it specifically needs.
- **self**: Internal imports within a single infrastructure concern are unrestricted. Cross-concern imports within infrastructure (e.g., auth importing from integrations) should be avoided but are not mechanically banned.
- **`features/`**: NO. Infrastructure never imports from features.
- **`domains/`**: NO. Infrastructure never imports from domains.
- **`shared/`**: YES. Infrastructure modules may use shared utilities.
- **`shared/ui/`**: NO. Infrastructure code has no reason to import UI components.
- **`routes/`**: NO. Infrastructure never imports from routes.
- **`env.server`**: YES. Infrastructure adapters read API keys, connection strings, and service config from validated server environment.
- **`env.client`**: YES. Some infrastructure modules (e.g., telemetry) may read client-safe env vars for configuration that applies in both contexts.

#### `features/*/controllers/`

- **`infrastructure/db/`**: Via repo if repo exists. When a feature has a `repo/` directory, controllers must not import DB schema directly (enforced by the `boundary/layer-occupancy` check). They pass the DB client to repo functions for transaction handling. When no `repo/` exists, controllers may import DB directly (layer occupancy policy).
- **`infrastructure/*`**: YES. Controllers are the feature's entry point for orchestrating infrastructure: auth middleware, SDK adapters, telemetry.
- **`features/`**: Public API only. Controllers import other features through `@/features/<name>` (client-safe barrel) or `@/features/<name>/server` (server-only barrel). No deep imports into another feature's internals.
- **`domains/`**: YES. Controllers invoke domain logic for business operations.
- **`shared/`**: YES. Controllers may use shared utilities.
- **`shared/ui/`**: NO. Controllers are server-side; they do not render UI.
- **`routes/`**: NO. Controllers serve routes, not the reverse.
- **`env.server`**: YES. Controllers run server-side and may read env config directly.
- **`env.client`**: YES. Controllers may reference client-safe config.

#### `features/*/service/`

- **`infrastructure/db/`**: NO. Service modules do not access DB directly. They go through `repo/` or, if no repo exists, the service layer itself wouldn't exist (the controller would call DB directly).
- **`infrastructure/*`**: NO. Service modules contain pure use-case orchestration. Infrastructure interaction is handled by the controller above or the repo below. If a service needs an infrastructure capability, it receives it as a parameter from the controller.
- **`features/`**: Public API only. Service modules may call other features' public APIs when orchestrating cross-feature workflows.
- **`domains/`**: YES. Service modules invoke domain logic for validation, transformation, and business rules.
- **`shared/`**: YES. Service modules may use shared utilities.
- **`shared/ui/`**: NO. Service modules do not render UI.
- **`routes/`**: NO. Service modules do not import from routes.
- **`env.server`**: NO. Service modules are kept pure of direct environment access. Config flows in from the controller layer.
- **`env.client`**: NO. Same reasoning as `env.server`.

#### `features/*/repo/`

- **`infrastructure/db/`**: YES. Repo modules are the feature's data access layer. They import schema tables from `infrastructure/db/schema` and the DB client from `infrastructure/db/client`.
- **`infrastructure/*`**: YES. Repo modules may import other infrastructure adapters (e.g., encryption utilities for data at rest).
- **`features/`**: NO. Repo is a leaf layer within its feature. It does not call other features.
- **`domains/`**: NO. Repo modules deal with persistence, not business logic.
- **`shared/`**: YES. Repo modules may use shared utilities.
- **`shared/ui/`**: NO. Repo modules do not render UI.
- **`routes/`**: NO. Repo modules do not import from routes.
- **`env.server`**: NO. Repo modules receive config (connection, encryption keys) from the layers above.
- **`env.client`**: NO. Repo modules are server-side only.

#### `features/*/ui/`

- **`infrastructure/db/`**: NO. UI components never access DB.
- **`infrastructure/*`**: NO, with two exceptions enforced via allowlist (the `boundary/client-server-infra` rule). The only client-safe infrastructure imports are `@/infrastructure/auth/client` and `@/infrastructure/providers/query-client`. All other infrastructure imports from UI are violations.
- **`features/`**: Own controllers (YES, via relative imports) and other features' client-safe public API (`@/features/<name>`) only. UI cannot deep-import another feature's controllers, service, repo, or UI. Cross-feature `ui/*` imports are banned.
- **`domains/`**: NO. UI components do not import domain logic directly. Domain types flow through controllers.
- **`shared/`**: YES. UI components use shared utilities, formatters, constants.
- **`shared/ui/`**: YES. UI components compose shared presentational components and use the theme.
- **`routes/`**: NO. UI components do not import from routes.
- **`env.server`**: NO. UI runs client-side; `env.server` is server-only.
- **`env.client`**: YES. UI components may read client-safe env vars (e.g., public API URLs, feature flags).

#### `domains/*`

- **`infrastructure/db/`**: NO. Domains are pure business logic with zero side effects.
- **`infrastructure/*`**: NO. Same principle. Domain functions accept adapters as parameters when they need external capabilities.
- **`features/`**: NO. Domains are lower-level than features. The dependency arrow points the other direction.
- **self (no cycles)**: Domains may import from other domains through their public API barrels, but cross-domain dependency cycles are a hard failure (the `graph/domain-cycles` check). Domain A importing domain B and domain B importing domain A is a structural violation.
- **`shared/`**: YES. Domains may use shared pure utilities.
- **`shared/ui/`**: NO. Domains contain no UI.
- **`routes/`**: NO. Domains never import from routes.
- **`env.server`**: NO. Domains must remain environment-agnostic. Config flows in as function parameters. Enforced by the `boundary/domain-purity` rule.
- **`env.client`**: NO. Same reasoning.

#### `shared/*`

- **`infrastructure/db/`, `infrastructure/*`, `features/`, `domains/`, `routes/`**: All NO. Shared utilities are the bottom of the dependency graph. They import nothing from the application. Enforced by the `boundary/shared-purity` rule (no `@/` imports at all from `shared/*.ts`).
- **self**: Shared files may import from each other within the `shared/` directory.
- **`env.server`**: NO. Shared utilities are pure.
- **`env.client`**: YES. Shared utilities may read client-safe config when needed for formatting or display logic.

#### `shared/ui/*`

- **`infrastructure/db/`, `infrastructure/*`, `features/`, `domains/`, `routes/`**: All NO. Shared UI is domain-agnostic. If a component needs business logic, it belongs in `features/*/ui/`. Enforced by the `boundary/shared-ui-purity` rule.
- **`shared/`**: YES. Shared UI components may use shared utilities (formatters, constants, type helpers).
- **self**: Shared UI components may import from each other.
- **`env.server`**: NO. Shared UI is client-rendered.
- **`env.client`**: YES. Shared UI may read client-safe env vars for theming, CDN URLs, etc.

#### `routes/*`

- **`infrastructure/db/`**: NO. Routes are thin transport adapters. They never query the DB directly. Enforced by the `boundary/route-thinness` rule.
- **`infrastructure/*`**: YES, limited. Routes may import from infrastructure for specific wiring needs (e.g., providers). Routes must not import SDK clients directly.
- **`features/`**: YES, public API + UI. Routes use three import patterns: `@/features/<name>` (barrel), `@/features/<name>/server` (server barrel), and `@/features/<name>/ui/*` (UI components for page composition). No deep imports into controllers, service, or repo.
- **`domains/`**: NO. Routes do not call domain logic directly. Domain operations flow through feature controllers.
- **`shared/`**: YES. Routes may use shared utilities.
- **`shared/ui/`**: YES. Routes compose shared UI primitives into pages.
- **self**: Route files may import from each other (layouts, shared route utilities).
- **`env.server`**: NO. Routes must not import `env.server` directly. Enforced by the `boundary/route-thinness` rule.
- **`env.client`**: YES. Routes may read client-safe config.

---

## Within-Feature Boundaries

The layer direction within a feature is:

```
ui/ --> controllers/ --> service/ --> repo/
```

Each arrow means "may import from." The flow is strictly top-down.

| Source ↓ imports Target → | `controllers/` | `service/` | `repo/` | `ui/` |
|---|:---:|:---:|:---:|:---:|
| **`controllers/`** | self | YES | YES (if no service) | NO |
| **`service/`** | NO | self | YES | NO |
| **`repo/`** | NO | NO | self | NO |
| **`ui/`** | YES | NO | NO | self |

### Key Rules

- **`controllers/` cannot import `ui/`** -- The server layer does not consume the client layer. Enforced by the `boundary/server-no-upward` rule.
- **`repo/` is a leaf** -- It imports nothing from feature siblings. Repo modules access infrastructure and return data upward.
- **`service/` cannot import `controllers/`** -- Layer direction is strictly downward.
- **Layer occupancy gating** -- If `service/` exists, `controllers/` goes through it to reach `repo/`. If `service/` does not exist, `controllers/` may import `repo/` directly. If `repo/` does not exist, the layer above it accesses infrastructure directly.
- **DB occupancy refinement** -- When `repo/` exists, `controllers/` cannot import `infrastructure/db/schema` directly (the `boundary/layer-occupancy` check). Schema-based query construction belongs in `repo/`. The DB client import (`infrastructure/db/client`) is still allowed for passing the client to repo functions for transactions.

---

## Cross-Feature Boundaries

Features import other features ONLY through public API barrels. All other internal paths are denied.

| Pattern | Allowed | From |
|---|---|---|
| `@/features/<name>` (resolves to `index.ts`) | YES | Any module |
| `@/features/<name>/server` (resolves to `server.ts`) | YES | Server contexts only |
| `@/features/<name>/ui/*` | YES | Routes only |
| `@/features/<name>/controllers/*` | NO | --- |
| `@/features/<name>/service/*` | NO | --- |
| `@/features/<name>/repo/*` | NO | --- |

Enforcement (the `api/feature-public-api` rule):

- Denies deep imports from routes unless the path matches `/server` or `/ui/*`.
- Denies deep imports from other features unless the path matches `/server`.
- Denies all deep feature imports from domains, shared, and infrastructure.
- The `api/server-import-context` rule denies `*/server` imports from client contexts (UI files, barrels, shared modules).

Cross-feature UI imports are banned even between features. If two features need the same UI component, it gets promoted to `shared/ui/` once three features need it (promotion threshold).

---

## Cross-Domain Boundaries

Domains import other domains through barrels only.

| Pattern | Allowed |
|---|---|
| `@/domains/<name>` (resolves to `index.ts`) | YES |
| `@/domains/<name>/server` (resolves to `server.ts`) | YES |
| `@/domains/<name>/<internal>/*` | NO |

Enforcement:

- The `api/domain-public-api` rule denies any import matching `@/domains/<name>/<path>` unless `<path>` is exactly `server`.
- The `graph/domain-cycles` check detects cross-domain dependency cycles via DFS and fails the build. Domain A importing domain B and domain B importing domain A (directly or transitively) is a hard structural violation.

---

## Cross-Boundary Import Rules

### The `@/` Alias Requirement

All imports that cross a top-level directory boundary (`features/`, `domains/`, `infrastructure/`, `shared/`, `routes/`) MUST use the `@/` path alias. Relative imports (`../`) that cross boundaries bypass path-based rule checking and are denied by the `boundary/cross-boundary-alias` rule.

```typescript
// CORRECT -- aliased cross-boundary import
import { getItems } from "@/features/inventory/server"

// VIOLATION -- relative cross-boundary import
import { getItems } from "../../features/inventory/server"

// CORRECT -- relative within feature
import { fetchItems } from "../controllers/items"

// CORRECT -- relative within subdirectory
import { validate } from "./validation"
```

The rule covers all six top-level boundaries:

- Files in `domains/` using relative paths to reach `features/`, `infrastructure/`, `shared/`, or `routes/`
- Files in `features/` using relative paths to reach `domains/`, `infrastructure/`, `shared/`, `routes/`, or other features
- Files in `infrastructure/` using relative paths to reach `domains/`, `features/`, `shared/`, or `routes/`
- Files in `shared/` using relative paths to reach `domains/`, `features/`, `infrastructure/`, or `routes/`
- Files in `routes/` using relative paths to reach `domains/`, `features/`, `infrastructure/`, or `shared/`

Within a feature or within a subdirectory, relative imports are expected and preferred.

---

## Public API Convention Table

| Module | Client-Safe Barrel (`index.ts`) | Server-Only Barrel (`server.ts`) | External Import Pattern |
|---|---|---|---|
| `features/<name>/` | Types, constants, pure helpers, `createServerFn` references, client UI re-exports | Server functions for cross-feature use, raw DB queries, infrastructure adapters | `@/features/<name>` or `@/features/<name>/server` |
| `domains/<name>/` | Types, pure functions, domain errors, constants, schemas | Server-only domain operations (optional) | `@/domains/<name>` or `@/domains/<name>/server` |
| `shared/` | No barrel, each file standalone | --- | `@/shared/<module>` |
| `shared/ui/` | Per-subdirectory barrels or individual imports | --- | `@/shared/ui/<component>` |
| `infrastructure/` | No barrel, each adapter standalone | `*.server.ts` files auto-denied from client | `@/infrastructure/<module>` |
| `infrastructure/db/` | --- | `schema/index.ts` barrel | `@/infrastructure/db`, `@/infrastructure/db/schema` |

### Barrel Invariants

**`index.ts` must NEVER import from `server.ts`.** The server module extends the client-safe barrel; the reverse creates bundler-breaking server-only leakage into client bundles. Enforced by the `api/barrel-direction` rule.

**`server.ts` MAY re-export from `index.ts`.** This allows the server barrel to present a superset of the client-safe API when convenient.

**`createServerFn` references belong in `index.ts`.** TanStack Start replaces server function implementations with RPC stubs in client bundles, making the reference itself client-safe. The function definition lives in `controllers/`, but the reference is re-exported through the client-safe barrel.

**Barrel client-safety.** A transitive trace from each `index.ts` barrel follows runtime imports up to 6 levels deep. If any branch reaches a server-only package, the `api/barrel-purity` check fails -- unless a `createServerFn` boundary is encountered first, which stops the trace (TanStack Start strips everything below it from client bundles).

### Server Context Definition

Server contexts are the directories/files allowed to import `*/server` paths (enforced by the `api/server-import-context` rule):

- `features/*/controllers/`
- `features/*/service/`
- `features/*/repo/`
- `infrastructure/*`
- `routes/*`
- Any file named `server.ts` or `server.tsx`

Client contexts (UI files, barrel `index.ts` files, `shared/*` files) must not import `*/server` paths.

### Client-Safe Infrastructure

Most infrastructure modules are server-only. Only designated modules are explicitly client-safe — for example, a browser-side auth client and a query client setup. All other infrastructure imports from client contexts (UI files, shared modules) are violations enforced by the `boundary/client-server-infra` rule. When adding a new client-safe infrastructure module, it must be added to that rule's allowlist.

---

## SDK Containment

External SDK packages are restricted from direct import outside designated modules. Two classification strategies exist.

### Wrapped SDKs

The raw package import is banned everywhere except the wrapper module. Consumer code imports the wrapper, never the raw package. Use wrapping for SDKs with:

- **Configuration complexity** — API keys, client options, retry policies
- **Security sensitivity** — Payment processing, auth libraries, email services
- **API instability** — Frequent breaking changes; the wrapper absorbs them

The wrapper configures the SDK and re-exports its interface (or a thin convenience layer). The goal is containment, not abstraction. Enforced by the `boundary/sdk-containment` rule, which denies imports of these packages from any file outside `infrastructure/`.

### Layer-Restricted SDKs

The raw import is allowed but only from designated directories. No wrapper exists.

Use layer restriction for SDKs with:

- **Simple configuration** — Works out of the box or is configured once
- **Pervasive usage within a layer** — ORMs imported by every repo file, schema libraries in every validation file
- **Stable APIs** — Doesn't change often enough to justify wrapping

### Server-Only Package Blocklist

The `api/barrel-purity` check maintains a list of server-only package patterns (Node.js built-ins, ORM packages, server SDK clients). Client-safe barrels must not transitively import these packages. Update this list when adding new server-only dependencies.

### Choosing a Strategy

Default to wrapped. Layer-restrict only when wrapping adds genuinely zero value. The cost of an unnecessary wrapper is one small file. The cost of an unwrapped SDK scattering across the codebase is a migration when the SDK changes its API or you need to swap providers.

### Adding a New SDK

1. Create an adapter in `infrastructure/integrations/<service>.ts` (or `infrastructure/<concern>/` for cross-cutting concerns like auth or telemetry).
2. The adapter imports the SDK, reads config from `env.server.ts`, and exports a configured client or helper functions.
3. Add the SDK package to the `boundary/sdk-containment` rule.
4. Add the SDK to the `api/barrel-purity` server-only patterns list if it uses Node.js built-ins or server-only APIs.
5. Features import the adapter, never the raw SDK.

---

## Enforcement

Every boundary in this document is mechanically enforced. For the complete rule catalog with mechanisms, blocking status, and links to each rule's template, see [rules/overview.md](rules/overview.md).
