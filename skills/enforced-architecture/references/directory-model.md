# Directory Model

Where every type of code lives, what it owns, and what it must not touch. This is the primary reference for placing code during planning and implementation.

---

## Configurable Choices

These choices are surfaced during Phase 2 (planning). Each shapes the target directory structure and enforcement rules. Select one option per choice; the combination determines the project's structural template.

### Choice 1: Domains Layer

Determines whether pure business logic gets its own top-level directory or lives inside features.

| Option | Structure |
|---|---|
| **With `domains/`** | Separate `domains/` directory for pure business logic. No side effects, no infrastructure imports. Functions accept dependencies as parameters. |
| **Without `domains/`** | Business logic lives inside features, co-located with delivery code. No `domains/` directory exists. |

**When to choose each:**

- **With `domains/`** when complex business logic exists that is independent of delivery mechanism. Parsers, analyzers, calculation engines, state machines, validation pipelines. The logic would make sense in a CLI, API, or UI -- it is not tied to how it gets delivered. If you find yourself writing pure functions that transform data structures without touching the database, network, or auth, those belong in a domain.
- **Without `domains/`** when most logic is CRUD, business rules are simple, or the codebase is small enough that separation adds ceremony without benefit. If every "domain function" would just be called from one controller, co-location is simpler.

**Recommendation:** Use `domains/` for any project with algorithmic or analytical logic. The purity constraint (no side effects) makes domain code trivially testable and portable. The cost is one extra wiring step in controllers.

### Choice 2: Intra-Feature Layering

Determines the internal structure of feature directories.

| Option | Structure |
|---|---|
| **Layered features** | Features use `controllers/ -> service/ -> repo/ -> ui/` internal structure. Layer occupancy is optional but order is fixed. Skip absent layers; cannot bypass present ones. Mechanically enforced. |
| **Flat features** | Features have a `controllers/` directory (the server function boundary) and everything else is unstructured. |

**When to choose each:**

- **Layered features** when features have complex data access patterns, multiple entities, or business orchestration that benefits from separation. Most established projects with more than trivial CRUD benefit from the structural guarantees that tighten automatically as features grow.
- **Flat features** when features are simple (mostly UI + server functions), the codebase is early stage, or the team wants to defer structural decisions until patterns emerge.

**Recommendation:** Use layered features. The layers are optional -- a feature with only `controllers/` and `ui/` is valid. You pay no cost for absent layers, but gain automatic enforcement when complexity arrives.

### Choice 3: Env Split Strategy

Determines how environment variables are organized.

| Option | Structure |
|---|---|
| **Split** | `env.server.ts` (secrets, server-only config, importable only from infrastructure) + `env.client.ts` (`VITE_PUBLIC_*` vars, importable from anywhere). |
| **Single** | `env.ts` with server/client sections. Simpler but relies on naming convention for safety. |

**When to choose each:**

- **Split** when using an SSR framework with bundle splitting (TanStack Start, Next.js, SvelteKit). The split prevents accidental secret leakage into client bundles. The bundler enforces the boundary -- a client-side import of `env.server.ts` is a build error, not a silent leak.
- **Single** when the project is server-only (CLI, API, background worker). No bundle splitting concern means no leakage risk.

**Recommendation:** Use split for any project with a browser-facing bundle. The cost is two files instead of one. The benefit is mechanical prevention of secret leakage.

**Implementation notes for `@t3-oss/env-core`:**

The env split is not just renaming files — the `runtimeEnv` configuration differs meaningfully between server and client contexts:

- **Server env** uses `runtimeEnv: process.env` — no prefix needed, all server-side vars are available directly.
- **Client env** uses `runtimeEnv: { VITE_PUBLIC_*: import.meta.env.VITE_PUBLIC_* }` — each public var must be explicitly mapped from Vite's `import.meta.env`.
- **Exports** should be named differently (`serverEnv` vs `clientEnv`) to make it obvious at import sites which context is being used.
- **`NODE_ENV`** belongs in server env — it is only available via `process.env`, not `import.meta.env`.

For Vite-based frameworks (TanStack Start, SvelteKit), client env vars must use the `VITE_PUBLIC_` prefix. For Next.js, the prefix is `NEXT_PUBLIC_`. The plan should include the exact env configuration code for the project's framework.

### Choice 4: Error Architecture

Determines how errors are structured across layers.

| Option | Structure |
|---|---|
| **Single error class** | One `ServerError` class with typed error codes at the server boundary. Routes switch on codes. |
| **Per-layer errors** | Each layer defines errors at its abstraction level. Domains define domain errors. Features define feature errors. Controllers catch and translate. |

**When to choose each:**

- **Single error class** when the project has 2 or fewer distinct layers, simple error flows, or errors do not need semantic translation between layers.
- **Per-layer errors** when 3+ layers with genuine error translation needs exist. Domain errors are semantically different from infrastructure errors (a "parse failure" is not the same as a "connection timeout"), and controllers need to map between them.

**Recommendation:** Use per-layer errors when using `domains/` + layered features. The abstraction levels are genuinely different, and typed error codes make controller translation exhaustive (TypeScript catches unhandled codes). Use single error class for simpler setups.

---

## Target Directory Structure

### Recommended Setup

With `domains/`, layered features, split env, per-layer errors. This is the full structure for a mature project.

```
src/
  domains/<name>/
    index.ts              # Public API barrel (types, pure functions)
    server.ts             # Server-only barrel (optional)
    errors.ts             # Domain error types
    ...                   # Internal modules (parsers, transforms, etc.)
  features/<name>/
    index.ts              # Client-safe barrel (types, serverFn refs, constants)
    server.ts             # Server-only barrel (optional; must not be imported by index.ts)
    errors.ts             # Feature error types with typed codes (optional)
    controllers/
      server-fns.ts       # Server function definitions
      chat-stream.ts      # Streaming endpoints (returns raw Response)
    service/              # Orchestration (optional)
      <workflow>.ts
    repo/                 # DB queries (optional)
      queries.ts
    ui/                   # Feature-specific components
      SomeComponent.tsx   # Routes import as @/features/<name>/ui/SomeComponent
  infrastructure/         # DB, auth, SDK adapters, telemetry
    db/
      client.ts           # Pool + Drizzle client
      schema/             # ALL table definitions (centralized)
        index.ts          # Central barrel (repos + migrations import this)
        auth.ts           # Auth-related tables
        relations.ts      # Cross-concern Drizzle relations
    auth/
      index.ts            # Server-side auth config
      client.ts           # Client-safe auth (explicitly allowlisted)
    integrations/         # External SDK wrappers
    telemetry/            # Observability
    providers/
      query-client.ts     # TanStack Query client (client-safe, explicitly allowlisted)
  shared/                 # Pure utilities & generic UI
    ui/
      theme.ts
      <Component>.tsx
    utils.ts
  routes/                 # Thin transport adapters
    __root.tsx
    _authed/
    api/
  test/                   # Shared test infrastructure
  env.server.ts           # Server-only config (secrets, DB URLs, API keys)
  env.client.ts           # Client-safe config (VITE_PUBLIC_* vars only)
```

### Simplified Setup

Without `domains/`, flat features, single env. For small or early-stage projects.

```
src/
  features/<name>/
    index.ts              # Public API barrel
    server.ts             # Server-only barrel (optional)
    controllers/
      server-fns.ts
    ui/
      SomeComponent.tsx
  infrastructure/
    db/
      client.ts
      schema/             # Centralized schema (same as recommended)
    auth/
    integrations/
    providers/
  shared/
    ui/
    utils.ts
  routes/                 # Thin transport adapters
  test/                   # Shared test infrastructure
  env.ts                  # Combined env config (server + client sections)
```

Key differences from the recommended setup:
- No `domains/` directory. Business logic lives in feature `controllers/` or alongside feature code.
- No `service/` or `repo/` layers inside features. Controllers access infrastructure directly.
- Single `env.ts` instead of split files. Only appropriate when no bundle splitting exists.

---

## Responsibility Split Table

For any type of work, this table tells you where code lives and what it must not import.

| Working on... | Look in | Don't reach into |
|---|---|---|
| UI components (feature-specific) | `features/*/ui/` | `repo/`, `infrastructure/`, `domains/` |
| UI components (reusable, no domain logic) | `shared/ui/` | `features/`, `domains/`, `infrastructure/`, `routes/` |
| Server functions (`createServerFn`) | `features/*/controllers/` | `routes/` internals, other features' repos |
| Business logic (pure, no side effects) | `domains/*/` | DB, auth, env, infrastructure, features |
| Business orchestration (multi-step workflows) | `features/*/service/` | DB directly (use `repo/`), UI |
| Data access (DB queries) | `features/*/repo/` | Other features' repos, other features' schema queries |
| DB schema (table definitions) | `infrastructure/db/schema/` | -- |
| DB client (connection pool) | `infrastructure/db/client.ts` | -- |
| External SDK integration | `infrastructure/integrations/` | Never import SDK packages directly in features |
| Auth configuration | `infrastructure/auth/` | Never import auth SDK directly in features |
| Auth client (browser-side) | `infrastructure/auth/client.ts` | Only client-safe infra module (explicitly allowlisted) |
| Telemetry / observability | `infrastructure/telemetry/` | -- |
| React providers | `infrastructure/providers/` | `query-client.ts` is client-safe (explicitly allowlisted) |
| Environment variables (secrets) | `env.server.ts` | Importable only from `infrastructure/*` |
| Environment variables (public) | `env.client.ts` | Importable from anywhere |
| Route handlers / pages | `routes/` | DB, infrastructure internals, `env.server` |
| Pure utilities / helpers | `shared/` | `features/`, `domains/`, `infrastructure/`, `routes/` |
| Error types (domain) | `domains/*/errors.ts` | Infrastructure concepts (no HTTP, no DB errors) |
| Error types (feature) | `features/*/errors.ts` | Domain-level abstraction (use product-level codes) |
| Tests | Co-located `*.test.ts` | No architectural restrictions on test imports |
| Test infrastructure | `test/` | No architectural restrictions |
| Scripts | `scripts/` | No architectural restrictions |

### Quick Decision Flowchart

When placing new code, ask these questions in order:

1. **Is it a pure data transformation with no side effects?** -> `domains/*/`
2. **Does it define a DB table or relation?** -> `infrastructure/db/schema/`
3. **Does it wrap an external SDK?** -> `infrastructure/integrations/`
4. **Does it configure auth, telemetry, or DB connections?** -> `infrastructure/*/`
5. **Is it a `createServerFn`?** -> `features/*/controllers/`
6. **Does it query the database?** -> `features/*/repo/`
7. **Does it orchestrate multiple repos, domains, or policies?** -> `features/*/service/`
8. **Is it a React component tied to a feature?** -> `features/*/ui/`
9. **Is it a React component used by 3+ features with no business imports?** -> `shared/ui/`
10. **Is it a pure utility function?** -> `shared/`
11. **Is it a route/page?** -> `routes/`

---

## Layer Hierarchy

From top (user-facing) to bottom (foundational):

1. `routes/` — transport adapters (framework-shaped)
2. `features/*/ui/` — feature-specific UI components
3. `features/*/controllers/` — server functions, feature entry point
4. `features/*/service/` — orchestration (optional)
5. `features/*/repo/` — data access (optional)
6. `domains/*` — pure business logic (optional)
7. `infrastructure/*` — DB, auth, SDK adapters
8. `shared/*` — pure utilities, generic UI

Lower layers never import upper layers. All layers may import from `shared/*`.

For the complete import boundary matrix (which cells are YES/NO and why), see [import-boundaries.md](import-boundaries.md).

For layer occupancy rules (skip absent layers, never bypass present ones), see [feature-patterns.md](feature-patterns.md).

For server/client file naming and bundle splitting conventions, see [server-client-boundaries.md](server-client-boundaries.md).
