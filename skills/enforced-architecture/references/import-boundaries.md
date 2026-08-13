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
| **`routes/*`** | NO | client-safe allowlist only | YES (client-safe public API + ui) | NO | YES | YES | self | NO | YES |

### Reading the matrix

Most cells follow from dependency direction alone: nothing imports upward, nothing imports `routes/`, and `shared/` sits at the bottom importing nothing from the application. Those cells need no explanation beyond the arrow.

The cells that carry real information are the qualified ones — where the answer is neither YES nor NO — and each has a rule behind it:

| Cell | What the qualifier means | Enforced by |
|---|---|---|
| `infrastructure/db/` → `env.server` — *`client.ts` only* | The client file reads connection config. No other DB file touches env. | `boundary/env-access` |
| `infrastructure/*` → `infrastructure/db/` — *designated files* | Auth reaches `db/client` and `db/schema` for its own tables; integrations generally reach neither. Each module imports only the DB files it needs. | `boundary/db-isolation` |
| `features/*/controllers/` → `infrastructure/db/` — *via repo, if it exists* | A present layer may not be bypassed. With no `repo/`, controllers reach DB directly and that is correct. | `boundary/layer-occupancy` |
| any → `features/` — *public API only* | `@/features/<name>` or `@/features/<name>/index.server`. Never a path into another feature's internals. | `api/feature-public-api` |
| `features/*/ui/` → `infrastructure/*` — *client-safe allowlist* | A short allowlist (a browser auth client, a query client). Everything else is server-only. | `boundary/client-server-infra` |
| `features/*/ui/` → `features/` — *own controllers, others' public API* | Relative imports within the feature; the client-safe barrel across features. Cross-feature `ui/*` is banned outright. | `api/feature-public-api` |
| `routes/*` → `features/` — *client-safe public API + `ui/*`* | Routes may deep-import `ui/`, and only `ui/`. Never `index.server`, controllers, service, or repo. | `api/feature-public-api`, `api/server-import-context` |
| `domains/*` → `domains/` — *self, no cycles* | Domains import each other through barrels; a cycle between two is a hard failure, because domains are the floor. | `graph/domain-cycles` |

Three cells look like ordinary NOs and are worth stating explicitly, because each is a purity claim rather than a direction claim:

- **`features/*/service/` imports no infrastructure and no env.** Service holds use-case orchestration; anything external arrives as a parameter from the controller above.
- **`features/*/repo/` imports no env.** Connection and key material arrive from the layers above, which keeps repo functions testable against any client.
- **`domains/*` imports no env, ever.** Config is a function parameter. Enforced by `boundary/domain-purity`, and it is what makes domain code portable.

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
| `@/features/<name>/index.server` (resolves to `index.server.ts`) | YES | Controllers, service, repo, infrastructure, and explicit `.server.ts` modules |
| `@/features/<name>/ui/*` | YES | Routes only |
| `@/features/<name>/controllers/*` | NO | --- |
| `@/features/<name>/service/*` | NO | --- |
| `@/features/<name>/repo/*` | NO | --- |

Enforcement (the `api/feature-public-api` rule):

- Denies deep imports from routes unless the path matches `/ui/*`.
- Denies deep imports from other features unless the path matches `/index.server`.
- Denies all deep feature imports from domains, shared, and infrastructure.
- The `api/server-import-context` rule denies `*/index.server` imports from client contexts (UI files, barrels, shared modules).

Cross-feature UI imports are banned even between features. If two features need the same UI component, it gets promoted to `shared/ui/` once three features need it (promotion threshold).

The cells above say *which paths* a cross-feature import may name. Whether the edge is allowed at all is a separate decision, and the default is open: any feature may import any other feature's public API. A project can flip that default to deny with [api/feature-visibility](rules/api/feature-visibility.md), which requires the importee to name each permitted consumer in its own `visibility.json`. Decide this in Phase 2 alongside the matrix — it changes the answer in every `features/` cell — and take it when agents write most of the code.

---

## Cross-Domain Boundaries

Domains import other domains through barrels only.

| Pattern | Allowed |
|---|---|
| `@/domains/<name>` (resolves to `index.ts`) | YES |
| `@/domains/<name>/index.server` (resolves to `index.server.ts`) | YES |
| `@/domains/<name>/<internal>/*` | NO |

Enforcement:

- The `api/domain-public-api` rule denies any import matching `@/domains/<name>/<path>` unless `<path>` is exactly `index.server`.
- The `graph/domain-cycles` check detects cross-domain dependency cycles via DFS and fails the build. Domain A importing domain B and domain B importing domain A (directly or transitively) is a hard structural violation.

---

## Cross-Boundary Import Rules

### The `@/` Alias Requirement

All imports that cross a top-level directory boundary (`features/`, `domains/`, `infrastructure/`, `shared/`, `routes/`) MUST use the `@/` path alias. Relative imports (`../`) that cross boundaries bypass path-based rule checking and are denied by the `boundary/cross-boundary-alias` rule.

```typescript
// CORRECT -- aliased cross-boundary import
import { getItems } from "@/features/inventory/index.server"

// VIOLATION -- relative cross-boundary import
import { getItems } from "../../features/inventory/index.server"

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

| Module | Client-Safe Barrel (`index.ts`) | Server-Only Barrel (`index.server.ts`) | External Import Pattern |
|---|---|---|---|
| `features/<name>/` | Types, constants, pure helpers, `createServerFn` references, client UI re-exports | Raw server helpers, DB queries, infrastructure adapters | `@/features/<name>` or `@/features/<name>/index.server` |
| `domains/<name>/` | Types, pure functions, domain errors, constants, schemas | Server-only domain operations (optional) | `@/domains/<name>` or `@/domains/<name>/index.server` |
| `shared/` | No barrel, each file standalone | --- | `@/shared/<module>` |
| `shared/ui/` | Per-subdirectory barrels or individual imports | --- | `@/shared/ui/<component>` |
| `infrastructure/` | No barrel, each adapter standalone | `*.server.ts` files auto-denied from client | `@/infrastructure/<module>` |
| `infrastructure/db/` | --- | `schema/index.server.ts` barrel | `@/infrastructure/db`, `@/infrastructure/db/schema/index.server` |

### Barrel Invariants

**`index.ts` must NEVER import from `index.server.ts`.** The server module extends the client-safe barrel; the reverse creates bundler-breaking server-only leakage into client bundles. Enforced by the `api/barrel-direction` rule.

**`index.server.ts` MAY re-export from `index.ts`.** This allows the server barrel to present a superset of the client-safe API when convenient.

**`createServerFn` references belong in `index.ts`.** TanStack Start replaces server function implementations with RPC stubs in client bundles, making the reference itself client-safe. The function definition lives in `controllers/`, but the reference is re-exported through the client-safe barrel.

**Why `index.server.ts` instead of `server.ts`:** The `index.server.ts` naming is automatically caught by vite's `**/*.server.*` import-protection pattern -- no need for additional `src/**/server.ts` file patterns in the import protection config. The naming also makes the server-only nature immediately obvious.

**Barrel client-safety.** A transitive trace from each `index.ts` barrel follows runtime imports up to 6 levels deep. If any branch reaches a server-only package, the `api/barrel-purity` check fails -- unless a `createServerFn` boundary is encountered first, which stops the trace (TanStack Start strips everything below it from client bundles).

### Server Context Definition

Server contexts are the directories/files allowed to import `*/index.server` paths (enforced by the `api/server-import-context` rule):

- `features/*/controllers/`
- `features/*/service/`
- `features/*/repo/`
- `infrastructure/*`
- `routes/*`
- Any file named `*.server.ts` or `*.server.tsx`

Client contexts (UI files, barrel `index.ts` files, `shared/*` files) must not import `*/index.server` paths.

### Client-Safe Infrastructure

Infrastructure is server-only by default; a short allowlist of modules is explicitly client-safe. See [server-client-boundaries.md](server-client-boundaries.md#client-safe-infrastructure).

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

Every boundary in this document is mechanically enforced, mostly by [rules/boundary/](rules/boundary/overview.md) and [rules/api/](rules/api/overview.md). For the full catalog and which tags this project needs, start at [rules/overview.md](rules/overview.md).
