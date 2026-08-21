# Feature Patterns

How a feature is shaped, when it grows a layer, and what its barrels hold.

---

## Scaling Tiers

Start at the smallest tier that fits. Graduate when the structure stops working, never before. Every
tier has the two barrels; the layers below them are what grows.

| Tier | Layers | Example |
|---|---|---|
| **Small** | `controllers/` | An auth feature wrapping a few server functions around an infrastructure adapter. No `repo/`, because it delegates. No `service/`, because it orchestrates nothing. No `ui/`, because it uses shared components |
| **Standard** | `controllers/`, `repo/` | A chat feature with conversations and messages. Controllers validate and authorize; repo modules hold the queries. No `service/`, because no workflow sits between them |
| **Complex** | `controllers/`, `service/`, `repo/`, `ui/` | An admin feature with fixtures, runs and a pipeline. Service orchestrates across repos. UI carries feature-specific meaning |

```
features/<name>/
  index.ts              # client-safe barrel
  index.server.ts       # server-only barrel
  errors.ts             # optional
  <layer>/              # from the table above
```

### Graduation triggers

Move from **small to standard** when the feature gains a second entity with server functions, when
one server-function file passes the file size limit, or when its queries get complex enough to earn a
`repo/` module.

Move from **standard to complex** when the feature needs client state beyond what routes provide,
when it gains components that carry feature-specific meaning and cannot go in `shared/ui/`, or when
it needs internal sub-modules.

Move code **out of the feature** when three features need the same thing. Three features needing the
same pure logic sends it to `shared/` or to a domain. Three features needing the same component with
no business imports sends it to `shared/ui/`. Two is a coincidence.

---

## Layer Occupancy

Layers have a fixed logical order: `ui → controllers → service → repo`. Physical presence is
optional.

**A layer that holds code may not be reached past.** That is the whole policy, and three details make
it exact.

- **Occupancy, not existence.** A directory counts as occupied when it holds at least one source
  file. An empty `controllers/` directory blocks nothing, which is another reason never to scaffold
  one.
- **Every edge, not just the ones leaving `controllers/`.** `ui/` importing `service/` over an
  occupied `controllers/` is the same finding as `controllers/` importing `repo/` over an occupied
  `service/`.
- **Type imports count.** Naming a lower layer's type binds this layer to that shape whether or not
  the import survives compilation.

So a feature with `controllers/`, `service/` and `repo/` all occupied routes every call
`controllers → service → repo`, and `controllers → repo` is the bypass. Empty the `service/`
directory and that same edge becomes the legal path.

With `repo/` occupied, nothing above it may import the database schema — query construction belongs
in `repo/`. The database *client* import stays legal, so a caller can still hand a transaction down.
— [boundary/layer-occupancy](lint/structural/boundary/layer-occupancy.ts)

Occupancy is not the only thing that closes an edge. A feature's `ui/` may not name a domain at all,
and a `service/` may not name infrastructure at all, whatever is occupied. Those are cells in the
import table, not occupancy findings. `ui/` importing infrastructure is a third owner again:
`boundary/client-server-infra` allows exactly two infrastructure modules into any client file.

---

## The `controllers/` Layer

Controllers are the delivery boundary, between transport and the rest of the system. Every
`createServerFn` lives here.

A controller validates its input, checks authorization, calls down into service, repo or a domain,
returns a plain serializable object, and throws a typed error on a business failure.

A controller does not hold pure business logic — that belongs in a domain — and it writes no raw
query while a `repo/` layer is occupied. What it may import is the import table's `feature-controllers`
row, not a list here.

**A file exporting `createServerFn()` uses a plain `.ts` name, and no rule enforces that.** Why the
compiler forces it, and why `controllers/jobs.server.ts` passes the whole catalog and still breaks
the client bundle: [server-client-boundaries.md](server-client-boundaries.md#a-createserverfn-file-must-not-use-serverts).

---

## Public API Barrels

A feature exposes its public API through two barrels. A consumer imports one of them and never
anything deeper.

| Export | Barrel | Why |
|---|---|---|
| Types, constants, pure helpers | `index.ts` | Erased or side-effect free, so safe in a client bundle |
| Error classes | `index.ts` | Both client and server code catch them |
| `createServerFn` references | `index.ts` | The compiler replaces the reference with an RPC stub |
| Repo modules and raw queries | `index.server.ts` | Server-only, for cross-feature data access |
| UI components | Neither | A route imports them directly: `@/features/<name>/ui/Component` |
| Internal helpers | Neither | Not public surface |

Two invariants hold between the two barrels, and both have a rule.
[api/barrel-direction](lint/oxlint/api/barrel-direction.ts): a client barrel may not name any
`index.server` module, its own or another unit's. The other direction is legal, so `index.server.ts`
may re-export `./index` and give a server caller the whole API in one import.
[api/barrel-purity](lint/structural/api/barrel-purity.ts): a trace from each `index.ts` follows
runtime imports six levels down and fails if a branch reaches a server-only package — unless a
`createServerFn` or `createMiddleware` call stops the trace first.

A feature's own barrel is off limits from inside the feature. The barrel re-exports every layer, so
importing it takes all of them on at once. — [placement/layer-direction](lint/structural/placement/layer-direction.ts)

### Which barrel a caller may name

`api/server-import-context` decides who may name an `index.server` path. Server contexts are a
feature's `controllers/`, `service/` and `repo/` directories, anything under `infrastructure/`, and
any file whose name carries the `.server` suffix before its extension — in any of the eight source
extensions, not only `.ts`.

`routes/` is deliberately absent, and the omission is the whole point. A route is isomorphic: the
same file runs on the server and ships to the browser. A route becomes a server context by naming
itself one, so `routes/api.users.server.ts` may take the server barrel and `routes/invoices.tsx` may
not.

---

## Cross-Feature Imports

A feature reaches another feature through its barrels, and a route may additionally reach
`@/features/<name>/ui/*`. Every other path into a feature is denied. Cross-feature `ui/` imports are
denied even between features.

**Being allowed to name the path is not the same as being allowed to make the edge.**
`api/feature-visibility` ships enabled and grants nothing by default: the importee must name each
permitted consumer, with a written reason, in a `visibility.json` at its own root. A project's first
cross-feature import fails until that file exists. Put the file in the plan alongside the feature
tree, because a reader who sees only the tree will not expect it.

---

## Database Schema

Schema lives in `infrastructure/db/schema/`, never in a feature and never in a domain.
`placement/schema-placement` enforces the position of the table definitions themselves.

```
infrastructure/db/schema/
  index.server.ts      # Central barrel
  relations.ts         # Cross-concern relations
  <concern>.ts         # One file per logical concern
```

A feature owns its queries, not its tables. Why that split is forced rather than chosen:
[architecture-principles.md](architecture-principles.md#schema-ownership-versus-query-ownership).

---

## Feature-Scoped Rules

A complex feature may need an internal rule the base set does not have — an editor feature that stops
canvas code importing sidebar components, for example, so the two communicate through shared state.

Know what that costs before planning one.

- **An oxlint rule cannot carry its own prefix inside the shipped plugin.** `plugin.ts` is one
  `definePlugin` with one `meta.name`, and every rule registered in it inherits that prefix. A rule
  id of the form `editor-boundary/no-canvas-sidebar-import` needs a **second plugin module**, added
  to `jsPlugins` in `.oxlintrc.json`. Registering it in the catalog's plugin instead gives it the
  catalog's prefix, which is exactly the thing the feature namespace exists to avoid.
- **A structural check cannot be scoped to one feature's subtree.** Scope comes from
  `declared-trees.ts` and is a whole source root; the check config has no field for a directory, on
  purpose. A feature-scoped question therefore belongs in the oxlint tier, or in a check that reads
  the feature name off the path itself.

Document a feature rule with the same header fields the catalog's rules use, and ship its spec beside
it like any other.
