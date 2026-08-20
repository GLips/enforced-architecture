# Import Boundaries

Definitive source of truth for "can module A import module B?" Every cell in every matrix is an explicit decision. When a cell says NO, the import is denied and enforced mechanically. When in doubt, the answer is NO. Relaxing a restriction later is trivial; tightening one after violations have been copied as patterns is expensive.

This reference covers the recommended setup: domains layer present, features with layered subdirectories (`controllers/`, `service/`, `repo/`, `ui/`). For simplified setups (no domains, flat features), remove the domains row/column and collapse the feature sub-rows.

---

## Import Boundary Matrix

Read as: "Can `{row}` import from `{column}`?"

| Source ↓ imports Target → | `infrastructure/db/` | `infrastructure/*` | `features/` | `domains/` | `shared/` | `shared/ui/` | `routes/` | `env.server` | `env.client` | source root | packages |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **`infrastructure/db/`** | self | NO | NO | NO | YES | NO | NO | `client.ts` only | NO | NO | YES |
| **`infrastructure/*`** | designated files | self | NO | NO | YES | NO | NO | YES | YES | NO | YES |
| **`features/*/controllers/`** | via repo (if exists) | YES | public API only | barrels only | YES | NO | NO | YES | YES | NO | YES |
| **`features/*/service/`** | NO | NO | public API only | barrels only | YES | NO | NO | NO | NO | NO | YES |
| **`features/*/repo/`** | YES | YES | NO | NO | YES | NO | NO | NO | NO | NO | YES |
| **`features/*/ui/`** | NO | client-safe allowlist only | own controllers, other features' public API | NO | YES | YES | NO | NO | YES | NO | YES |
| **`domains/*`** | NO | NO | NO | barrels, self (no cycles) | YES | NO | NO | NO | NO | NO | types only |
| **`shared/*`** | NO | NO | NO | NO | self | NO | NO | NO | YES | NO | YES |
| **`shared/ui/*`** | NO | NO | NO | NO | YES | self | NO | NO | YES | NO | YES |
| **`routes/*`** | NO | client-safe allowlist only | YES (client-safe public API + ui) | NO | YES | YES | self | NO | YES | NO | YES |
| **`features/*/index.ts`** | NO | NO | NO | NO | NO | NO | NO | NO | NO | NO | NO |
| **`features/*` root files** | NO | NO | barrels only | barrels only | YES | NO | NO | NO | NO | NO | YES |
| **source root** (`client.tsx`, `router.tsx`, …) | NO | YES | NO | NO | YES | YES | YES | YES | YES | self | YES |

### Reading the matrix

Most cells follow from dependency direction alone: nothing imports upward, nothing imports `routes/`, and `shared/` sits at the bottom importing nothing from the application. Those cells need no explanation beyond the arrow.

The cells that carry real information are the qualified ones — where the answer is neither YES nor NO — and each has a rule behind it:

| Cell | What the qualifier means | Enforced by |
|---|---|---|
| `infrastructure/db/` → `env.server` — *`client.ts` only* | The client file reads connection config. No other DB file touches env. | `boundary/ambient-globals` |
| `infrastructure/*` → `infrastructure/db/` — *designated files* | Auth reaches `db/client` and `db/schema` for its own tables; integrations generally reach neither. Each module imports only the DB files it needs. | `boundary/db-isolation` |
| `features/*/<layer>/` → `infrastructure/db/schema` — *via the lowest layer, if it is occupied* | A present layer may not be bypassed. With no `repo/`, the layer above reaches DB directly and that is correct. | `boundary/layer-occupancy` |
| any → `features/` — *public API only* | `@/features/<name>` or `@/features/<name>/index.server`. Never a path into another feature's internals. | `boundary/import-policy` |
| `features/*/ui/` → `infrastructure/*` — *client-safe allowlist* | A short allowlist (a browser auth client, a query client). Everything else is server-only. | `boundary/client-server-infra` |
| `features/*/ui/` → `features/` — *own controllers, others' public API* | Relative imports within the feature; the client-safe barrel across features. Cross-feature `ui/*` is banned outright, and so is the feature's own barrel from inside it. | `boundary/import-policy`, `placement/layer-direction` |
| `routes/*` → `features/` — *client-safe public API + `ui/*`* | Routes may deep-import `ui/`, and only `ui/`. Never `index.server`, controllers, service, or repo. | `boundary/import-policy`, `api/server-import-context` |
| `domains/*` → `domains/` — *barrels, self, no cycles* | Domains import each other through barrels; a cycle between two is a hard failure, because domains are the floor. | `boundary/import-policy`, `graph/domain-cycles` |
| `domains/*` → packages — *types only* | A type import is erased and cannot change what an answer depends on. A runtime one can, including a schema library — parsing is a boundary decision. | `boundary/import-policy` |

The last three rows and the last two columns are positions with no directory of their own, and they are in the table because `boundary/import-policy` decides them whether or not anyone wrote them down:

- **`features/*/index.ts`** — a feature's barrel imports NOTHING outside its own feature. It exists to re-export, and every dependency it takes on is one every consumer inherits without asking.
- **`features/*` root files** — `errors.ts` and friends sit in no layer. They may reach a barrel and `shared/`, and nothing else; they may not reach their own feature's barrel, which is a cycle (`placement/layer-direction`).
- **source root** — `client.tsx`, `router.tsx`, `server.ts` and the env modules are ONE unit, so they import each other freely. **`env.server` from this row is permitted by the policy and fenced only by the bundler**, because one profile covers both the browser entrypoint and the server one. If that matters to a project, split the row before adopting.
- **packages** are the column every other rule forgets. Only `domains/*` is restricted, and only at runtime: a domain may name a package's TYPES from anywhere and execute none of them. Containment of a specific package is `boundary/sdk-containment`'s question, not this table's.

Three cells look like ordinary NOs and are worth stating explicitly, because each is a purity claim rather than a direction claim:

- **`features/*/service/` imports no infrastructure and no env.** Service holds use-case orchestration; anything external arrives as a parameter from the controller above.
- **`features/*/repo/` imports no env.** Connection and key material arrive from the layers above, which keeps repo functions testable against any client.
- **`domains/*` imports no env, ever.** Config is a function parameter. Enforced by the `domain` row of `boundary/import-policy`, which additionally holds domains to *runtime* purity: a domain may name a type from anywhere it may import at all, and may execute code only from other domains and `shared/`. That is what makes domain code portable.

---

## Within-Feature Boundaries

| Source ↓ imports Target → | `controllers/` | `service/` | `repo/` | `ui/` |
|---|:---:|:---:|:---:|:---:|
| **`controllers/`** | self | YES | YES (if no service) | NO |
| **`service/`** | NO | self | YES | NO |
| **`repo/`** | NO | NO | self | NO |
| **`ui/`** | YES | NO | NO | self |

Flow is strictly `ui/ → controllers/ → service/ → repo/`, and `repo/` is a leaf. Upward imports inside one feature are denied by `placement/layer-direction`, which is also what denies a layer reaching its own feature's barrel — the barrel re-exports every layer, so importing it takes on all of them at once. Skipping a layer that exists on disk is `boundary/layer-occupancy`, a different question. `boundary/server-no-upward` is neither: it scopes to `src/infrastructure/**` and denies infrastructure reaching `features/`, `domains/` or `routes/`.

**Occupancy gates the skips.** A layer that holds code may not be bypassed, from any layer above it: with `controllers/` occupied, `ui/` reaches `service/` through it; with `controllers/` absent, directly. Type imports count — naming a lower layer's type binds this layer to that shape whether or not the import compiles away. With `repo/` occupied, nothing above it may import `infrastructure/db/schema` — query construction belongs in `repo/` — while the DB *client* import stays legal so a caller can hand a transaction down. Enforced by `boundary/layer-occupancy`.

---

## Cross-Feature Boundaries

Features import other features ONLY through public API barrels. All other internal paths are denied.

| Pattern | Allowed | From |
|---|---|---|
| `@/features/<name>` (resolves to `index.ts`) | YES | Any module |
| `@/features/<name>/index.server` (resolves to `index.server.ts`) | YES | Controllers, service, and explicit `.server.ts` modules. Not `repo/`, which is a leaf, and not `infrastructure/`, which sits below features |
| `@/features/<name>/ui/*` | YES | Routes only |
| `@/features/<name>/controllers/*` | NO | --- |
| `@/features/<name>/service/*` | NO | --- |
| `@/features/<name>/repo/*` | NO | --- |

Enforced by `boundary/import-policy`, whose feature column is a *surface* rather than a yes/no — the barrels for most rows, the barrels plus the `ui/` subtree for routes. `api/server-import-context` additionally denies `*/index.server` from client contexts (UI files, barrels, `shared/`).

Cross-feature UI imports are banned even between features. If two features need the same UI component, it gets promoted to `shared/ui/` once three features need it (promotion threshold).

The cells above say *which paths* a cross-feature import may name. Whether the edge is allowed at all is a separate decision, and the default is open: any feature may import any other feature's public API. A project can flip that default to deny with [api/feature-visibility](lint/structural/api/feature-visibility.ts), which requires the importee to name each permitted consumer in its own `visibility.json`. Decide this in Phase 2 alongside the matrix — it changes the answer in every `features/` cell — and take it when agents write most of the code.

---

## Cross-Domain Boundaries

Domains import other domains through barrels only.

| Pattern | Allowed |
|---|---|
| `@/domains/<name>` (resolves to `index.ts`) | YES |
| `@/domains/<name>/index.server` (resolves to `index.server.ts`) | YES |
| `@/domains/<name>/<internal>/*` | NO |

Enforced by `boundary/import-policy`, whose domain column says `barrel` for the four positions that may reach a domain at all — a feature's `controllers/` and `service/`, a module at a feature's root, and another domain — and `deny` for the other eight, which may not name a domain by any spelling, barrel included. The table above is the *domain-to-domain* row; it is not what a route or a `shared/` helper gets. `graph/domain-cycles` fails the build on a cross-domain cycle, direct or transitive — domains are the floor, so a cycle there has nowhere to break.

---

## Cross-Boundary Import Rules

### The `@/` Alias Requirement

All imports that leave the **unit** they are written in — a feature, a domain, `infrastructure/`, `shared/`, `shared/ui/`, `routes/` — MUST use the `@/` path alias. Relative imports (`../`) that leave a unit bypass path-based rule checking and are denied by the structural half of `boundary/import-policy`.

A unit is finer than a top-level directory, and that is deliberate: `shared/ui/` and the rest of `shared/` are one *boundary* and two *units*, so a primitive reaching `../lib/tokens` is a crossing even though both ends sit under `shared/`. Reading "the first path segment" as the boundary is exactly what let that edge go ungoverned in the rules this replaced.

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

External SDK packages are restricted from direct import outside designated modules. Two strategies; default to **wrapped**, and layer-restrict only when wrapping adds genuinely zero value. An unnecessary wrapper costs one small file; an unwrapped SDK scattered across the codebase costs a migration when its API changes or the provider is swapped.

### Wrapped SDKs

The raw package import is banned everywhere except the wrapper module, which configures the SDK and re-exports its interface. The goal is containment, not abstraction. Enforced by `boundary/sdk-containment`, which reads one row per package in `lint/policy/package-owners.ts`: the owners are named modules, so the rule can say *who* may import it rather than only *where*. Wrap when the SDK carries configuration complexity (keys, client options, retries), security sensitivity (payments, auth, email), or an unstable API the wrapper can absorb.

### Layer-Restricted SDKs

The raw import is allowed, from designated directories only, with no wrapper. Fits an SDK configured once and used pervasively within one layer — an ORM every repo file imports, a schema library every validation file imports — whose API is stable enough that a wrapper would only forward calls.

### Adding a New SDK

1. Create an adapter in `infrastructure/integrations/<service>.ts` (or `infrastructure/<concern>/` for cross-cutting concerns like auth or telemetry).
2. The adapter imports the SDK, reads config from `env.server.ts`, and exports a configured client or helper functions.
3. Add a row to `lint/policy/package-owners.ts` naming the adapter as the package's owner, with the `why`.
4. Add the SDK to the `api/barrel-purity` server-only patterns list if it uses Node.js built-ins or server-only APIs.
5. Features import the adapter, never the raw SDK.

---

## Enforcement

Every boundary in this document is mechanically enforced, mostly by the [boundary](lint/oxlint/boundary/overview.md) and [api](lint/oxlint/api/overview.md) tags across both tiers. For the full catalog and which tags this project needs, start at [lint/overview.md](lint/overview.md).
