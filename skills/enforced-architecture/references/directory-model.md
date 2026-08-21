# Directory Model

Where each kind of code lives, and the four choices that shape the tree.

This doc answers "where does this file go?" before the file exists. It does not answer "may A import
B?" — [lint/policy/import-policy.ts](lint/policy/import-policy.ts) holds that table, and the rule
prints the answer with the offending path in it. Do not copy that table into a doc.

---

## Configurable Choices

Make one choice per section. The four together produce the project's tree. Record each choice and
its reason in the plan document.

### Choice 1: Domains layer

| Option | Structure |
|---|---|
| **With `domains/`** | A top-level `domains/` directory holds pure business logic. No side effects, no infrastructure imports. Its functions take their dependencies as parameters. |
| **Without `domains/`** | Business logic sits inside features, next to the delivery code. There is no `domains/` directory. |

Choose `domains/` when the project has logic that does not depend on delivery: parsers, analyzers,
calculation engines, state machines, validation pipelines. The same logic would make sense in a CLI,
an API or a UI. A pure function that transforms data and never touches the database, the network or
auth belongs in a domain.

Choose no `domains/` when most logic is CRUD, when the business rules are simple, or when the
codebase is small. If every domain function would have one caller, keep it next to that caller.

**Recommendation:** take `domains/` for any project with algorithmic or analytical logic. Purity
makes the code easy to test and easy to move. The cost is one wiring step in each controller.

### Choice 2: Intra-feature layering

| Option | Structure |
|---|---|
| **Layered features** | A feature uses `ui/ → controllers/ → service/ → repo/`. A layer that holds code may not be bypassed. Upward imports are denied. |
| **Flat features** | A feature has a `controllers/` directory for its server functions. Nothing else inside it is structured. |

Choose layered features when features have several entities, complex data access, or orchestration.
Choose flat features when a feature is mostly UI plus server functions, or when the codebase is
early.

**Recommendation:** take layered features. Every layer is optional, so a feature with only
`controllers/` and `ui/` is valid. An absent layer costs nothing, and the enforcement arrives with
the complexity. Tiers and their triggers: [feature-patterns.md](feature-patterns.md).

### Choice 3: Env split

| Option | Structure |
|---|---|
| **Split** | `env.server.ts` holds secrets and server-only config. `env.client.ts` holds the public vars. |
| **Single** | One `env.ts` with a server section and a client section. |

Choose the split for any project with a browser bundle. Choose the single file only for a server-only
project — a CLI, an API, a worker — where no bundle splits.

**Recommendation:** take the split. The cost is one extra file.

The split is what lets the policy say different things about the two. Nine of the twelve positions
are denied `env.server`, and `boundary/route-thinness` denies it from a route a second time. One
position is not fenced by any rule: the source root, where a single profile covers both the browser
entrypoint and the server one, so the bundler is the only thing stopping the leak there. A project
that wants a rule instead splits that profile in two and decides both rows.

**Splitting `@t3-oss/env-core` is more than splitting the file.** `runtimeEnv` differs by context.
The server env takes `process.env` whole. The client env must map each public var out of
`import.meta.env` by name. `NODE_ENV` belongs in the server env, because `import.meta.env` does not
carry it. Name the exports `serverEnv` and `clientEnv`, so the import site says which context it is
in. The public prefix belongs to the framework: `VITE_PUBLIC_` under Vite, `NEXT_PUBLIC_` under
Next. The plan carries the exact config for this project.

A project on the single-env option still maps that file as the server env, because a combined module
carries the secrets.

### Choice 4: Error architecture

| Option | Structure |
|---|---|
| **Single error class** | One `ServerError` class with typed codes, at the server boundary. Routes switch on the code. |
| **Per-layer errors** | Each layer defines errors at its own abstraction level. Controllers catch and translate. |

Choose a single class when the project has two layers or fewer, or when no error needs translating
between layers. Choose per-layer errors when three or more layers translate error meaning — a parse
failure is not a connection timeout, and the controller has to map one to the other.

**Recommendation:** take per-layer errors with `domains/` plus layered features. Typed codes make the
controller's translation exhaustive, so TypeScript catches an unhandled code. Take the single class
for anything simpler.

---

## Target Directory Structure

### Recommended

`domains/`, layered features, split env, per-layer errors.

```
src/
  domains/<name>/
    index.ts              # Client-safe barrel: types, pure functions
    index.server.ts       # Server-only barrel (optional)
    errors.ts             # Domain error types
    ...                   # Internal modules
  features/<name>/
    index.ts              # Client-safe barrel: types, server-fn references, constants
    index.server.ts       # Server-only barrel (optional)
    errors.ts             # Feature error types with typed codes (optional)
    controllers/          # Server function definitions
    service/              # Orchestration (optional)
    repo/                 # DB queries (optional)
    ui/                   # Feature-specific components
  infrastructure/
    db/
      client.ts           # Pool and ORM client
      schema/             # ALL table definitions
        index.server.ts   # Central barrel
        relations.ts      # Cross-concern relations
    auth/
      index.ts            # Server-side auth config
      client.ts           # Browser auth client (client-safe)
    integrations/         # External SDK wrappers
    telemetry/            # Observability
    providers/
      query-client.ts     # Query client (client-safe)
  shared/
    ui/
      theme.ts            # The token source
      <Component>.tsx
    utils.ts
  routes/                 # Thin transport adapters
    __root.tsx
  gen/                    # Generated output — every rule is silent inside it
  test/                   # Shared test infrastructure
  client.tsx              # Browser entrypoint
  server.ts               # Server entrypoint
  router.tsx              # Router construction
  routeTree.gen.ts        # Generated route tree
  styles.css              # The token stylesheet
  env.server.ts
  env.client.ts
```

Three things in that tree are load-bearing in a way their names do not show.

- **The files directly in the source root are a closed set:** the four entrypoint positions, the env
  modules, and the token stylesheet. `placement/topology` rejects any other file there. Their names
  are vocabulary, so a project that spells one differently renames it in one place.
- **`auth/client.ts` and `providers/query-client.ts` are the only two infrastructure modules a client
  file may import.** That list lives in `boundary/client-server-infra` and it is the whole list.
  `db/client.ts` is an ordinary server-only module that happens to share the word.
- **`errors.ts` is the only non-barrel file permitted at a feature's root.** `placement/topology`
  rejects any other. Everything else in a feature belongs to a layer.

A feature that another feature imports also needs a `visibility.json` at its root, naming each
permitted consumer with a reason. `api/feature-visibility` ships enabled and grants nothing by
default, so the first cross-feature import in a new project fails until that file exists.

### Simplified

No `domains/`, flat features, single env. Three deletions from the tree above. Drop the `domains/`
directory, and business logic sits in the feature. Drop `service/` and `repo/`, and controllers
reach infrastructure directly. Replace the two env files with one `env.ts`.

### One tree or several

`src/` above is one **declared tree** — a source root plus the names its directories use. A
single-package repo declares one. A monorepo declares one per governed source root, and each root
gets its own copy of the shape above under its own names. Declare every one of them in
[lint/policy/declared-trees.ts](lint/policy/declared-trees.ts). A source root that is not on that
list is governed by almost nothing, and nothing says so.

---

## Where Work Goes

Find the row for the work, and put the file in the directory it names.

| Working on... | Look in |
|---|---|
| UI for one feature | `features/<name>/ui/` |
| UI reusable across features, with no domain logic | `shared/ui/` |
| A server function (`createServerFn`) | `features/<name>/controllers/` |
| Pure business logic | `domains/<name>/` |
| A multi-step workflow | `features/<name>/service/` |
| A database query | `features/<name>/repo/` |
| A table definition | `infrastructure/db/schema/` |
| The database connection | `infrastructure/db/client.ts` |
| An external SDK | `infrastructure/integrations/` |
| Auth configuration | `infrastructure/auth/` |
| The browser auth client | `infrastructure/auth/client.ts` |
| Telemetry | `infrastructure/telemetry/` |
| A React provider | `infrastructure/providers/` |
| A secret or server-only config value | `env.server.ts` |
| A public config value | `env.client.ts` |
| A page or route handler | `routes/` |
| A pure utility | `shared/` |
| A design token | `shared/ui/theme.ts` |
| A domain error type | `domains/<name>/errors.ts` |
| A feature error type | `features/<name>/errors.ts` |
| A test | Beside the file it tests, as `<name>.test.ts` |
| Shared test infrastructure | `test/` |
| A one-off script | `scripts/` |

A component moves out to `shared/ui/` when three features need it and it carries no business
imports. Two features needing it is a coincidence. Nothing enforces that number, so the promotion is
a judgment the reviewer makes.

---

## Layer Hierarchy

The tree has twelve positions. A file's position decides what it may import.

Eight of them form the ladder, from the top (user-facing) to the bottom (foundational):

1. `routes/` — transport adapters
2. `features/<name>/ui/`
3. `features/<name>/controllers/`
4. `features/<name>/service/` (optional)
5. `features/<name>/repo/` (optional)
6. `domains/<name>/` (optional)
7. `infrastructure/`
8. `shared/`

Four positions sit outside the ladder: a feature's `index.ts` barrel, a feature's root files
(`errors.ts` and its siblings), `shared/ui/`, and the source root (`client.tsx`, `router.tsx`,
`server.ts` and the env modules).

Four statements describe the model. Each one is exact.

- **A lower position never imports a higher one.** This is the invariant every import rule protects.
  It is a necessary condition, not a sufficient one: plenty of downward edges are denied too. A
  feature's `ui/` may not name a domain, a `service/` may not name infrastructure, and a domain may
  not name infrastructure. Read the cell; do not infer it from the ladder.
- **Eleven of the twelve positions may import `shared/`.** The exception is a feature's `index.ts`
  barrel, which imports nothing outside its own feature.
- **Four of the twelve may import `shared/ui/`:** `routes/`, a feature's `ui/`, `shared/ui/` itself,
  and the source root. `shared/` and `shared/ui/` are two positions, not one.
- **Two areas are reached through a barrel: features and domains.** Everywhere else a permitted
  import may name any module in the area. One import reaches past a barrel and no other does: a route
  may import `@/features/<name>/ui/*`.

The table behind those statements is [import-policy.ts](lint/policy/import-policy.ts): twelve
source positions by ten target areas, 120 cells, every one decided. Read a cell there rather than a
restatement here. When a rule denies an import it names the file's position, the area the import
lands in, and a paragraph on why that position works this way — written with this project's own
directory names in it.

Directory-wide layer occupancy: [feature-patterns.md](feature-patterns.md). Server and client file
naming: [server-client-boundaries.md](server-client-boundaries.md).
