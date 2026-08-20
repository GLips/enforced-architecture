# Feature Patterns

Feature scaling patterns, internal structure, layer occupancy, and public API conventions.

---

## Feature Scaling Templates

Features scale through three tiers. Start at the smallest tier that fits. Graduate when the structure becomes insufficient.

### Small Feature

Few entities, minimal client logic. Just controllers and barrels.

```
features/<name>/
  index.ts                # Public API barrel
  index.server.ts         # Server-only barrel (optional)
  controllers/
    <name>.ts             # Server functions
```

Example: an auth feature that wraps a few server functions around an infrastructure auth adapter. No repo needed (delegates to infrastructure), no service needed (no orchestration), no feature-specific UI (uses shared components).

### Standard Feature

Multiple entities, each with their own server function file.

```
features/<name>/
  index.ts
  index.server.ts
  controllers/            # Server functions
    *.ts
  repo/                   # DB queries (optional)
    *.ts
```

Example: a chat feature with conversation and message entities. Controllers validate input and authorize access. Repo modules encapsulate Drizzle queries. No service layer because controllers call repo directly without multi-step orchestration.

### Complex Feature

Rich client behavior, multiple sub-concerns, internal orchestration.

```
features/<name>/
  index.ts
  index.server.ts
  controllers/            # Server functions
    *.ts
  service/                # Orchestration (optional)
    *.ts
  repo/                   # DB queries (optional)
    *.ts
  ui/                     # Feature-specific components
    *.tsx
```

Example: an admin feature with fixtures, runs, a processing pipeline, and dedicated UI components. Controllers validate and authorize. Service orchestrates multi-repo workflows. Repos own Drizzle queries. UI components carry feature-specific semantics.

---

## Layer Occupancy Policy

Layers are logically fixed in order: `ui -> controllers -> service -> repo`. Physical presence is optional.

Occupancy is directory-wide, and it is asked at EVERY edge inside a feature — not only the ones leaving `controllers/`. What makes an edge a bypass is not its length but whether a layer it jumps over holds code.

| Layers present | Valid call paths | Invalid |
|---|---|---|
| `controllers` only | `controllers -> infrastructure`, `controllers -> domains` | -- |
| `controllers`, `repo` | `controllers -> repo -> infrastructure` | `controllers -> infrastructure/db/schema` (repo exists, must use it) |
| `controllers`, `service`, `repo` | `controllers -> service -> repo -> infrastructure` | `controllers -> repo` (service exists, must use it) |
| `controllers`, `service` (no repo) | `controllers -> service -> infrastructure` | -- |
| `ui`, `controllers` | `ui -> controllers` | `ui -> infrastructure` |
| `ui`, `controllers`, `service` | `ui -> controllers -> service` | `ui -> service` (controllers exists, must use it) — including `import type` |
| `ui`, `service` (no controllers) | `ui -> service` | -- |

A layer that exists may not be reached past. The `boundary/layer-occupancy` check enforces this directory-wide, for every layer and every source — `ui/` importing `service/` over an occupied `controllers/` is the same finding — and it counts type imports, because the shape a layer names is part of its contract whether or not the import survives compilation.

**Never scaffold empty directories.** If a layer has no code, it does not exist. Create directories only when they will contain active code.

---

## Graduation Triggers

### Small to Standard

- Multiple entity types with server functions
- Single server function file exceeds the file size limit
- Feature needs DB queries complex enough to warrant a dedicated repo module

### Standard to Complex

- Feature needs client-side state management beyond what routes provide
- Feature has UI components with feature-specific semantics (not promotable to `shared/ui/`)
- Feature needs internal sub-modules (specialized UI subdirectories, service orchestration)
- Interactions require internal layering rules

### Feature to Extract Shared

- 3+ features need the same pure logic -> extract to `shared/` or `domains/`
- 3+ features need the same UI component without business imports -> extract to `shared/ui/`
- Two features sharing something could be coincidence. Three is a pattern.

---

## The controllers/ Pattern

Controllers are the delivery boundary. They sit between transport (routes) and the rest of the system. Every `createServerFn` lives in `controllers/`.

Controllers do:
- Validate input with `.validator()`
- Check authorization (via session helpers from infrastructure)
- Orchestrate calls to service/repo/domain layers
- Return plain serializable objects
- Throw typed errors for business failures

Controllers do NOT:
- Import UI code, route code, or other features' internals
- Import other features except through public API barrels
- Contain pure business logic (that belongs in `domains/`)
- Contain raw DB queries when a `repo/` directory exists (the `boundary/layer-occupancy` check enforces this, for every layer above `repo/` and not only controllers)

### Controller file naming and the two-file split

Files exporting `createServerFn()` use plain `.ts`, because their RPC references must stay client-importable. Raw server-only helpers go in a `.server.ts` sibling. The compiler rewrites server-function handlers before import protection runs, so imports used only inside a handler are pruned from the client output.

Controllers are re-exported through the feature barrel:

```typescript
// features/<name>/index.ts
export { loadItemFn, createItemFn } from "./controllers/items";
```

Both the single-file and two-file patterns, with the conventions that go with them: [server-client-boundaries.md](server-client-boundaries.md#server-function-pattern).

---

## Public API Barrels

Every feature exposes its public API through barrel files. External consumers import through these -- never deeper.

### `index.ts` (Client-Safe)

Exports types, constants, pure helpers, createServerFn references, and UI component re-exports. Safe to import from anywhere including client bundles.

```typescript
// features/chat/index.ts

// Server function references (client-safe -- TanStack Start replaces with RPC stubs)
export { chatStreamFn, ServerFnChatTransport } from "./controllers/chat-stream";
export {
  listConversationsFn,
  loadConversationFn,
  type PersistedMessage,
} from "./controllers/conversations";
// Errors
export { ChatError, type ChatErrorCode } from "./errors";
```

### `index.server.ts` (Server-Only)

Exports server-only code for cross-feature use. Auto-denied from client bundles by vite's `**/*.server.*` import-protection pattern.

```typescript
// features/chat/index.server.ts
export { conversationRepo } from "./repo/conversations";
export { messageRepo } from "./repo/messages";
```

### What Goes Where

| Export type | Barrel | Rationale |
|---|---|---|
| TypeScript types/interfaces | `index.ts` | Types are erased at runtime, always client-safe |
| Constants, enums | `index.ts` | Pure values, no server dependency |
| Pure utility functions | `index.ts` | No side effects, safe for both environments |
| `createServerFn` references | `index.ts` | Client-safe -- compiler replaces with RPC stubs |
| Error classes and types | `index.ts` | Used by both client and server code |
| UI components | NOT barrel-exported | Routes import directly: `@/features/<name>/ui/Component` |
| Repo modules, raw queries | `index.server.ts` | Server-only, cross-feature data access |
| Internal helpers | Neither | Not part of public API |

Barrel invariants — which direction re-exports may run, and what each barrel may hold — are in [import-boundaries.md](import-boundaries.md#barrel-invariants), alongside the cross-feature import table naming which paths another feature may reach.

---

## DB Schema Centralization

DB schema always lives in `infrastructure/db/schema/`. Never in feature directories, never in domains.

```
infrastructure/db/schema/
  index.ts             # Central barrel (all tables + relations)
  relations.ts         # Cross-concern Drizzle relations
  auth.ts              # Auth-related tables
  chat.ts              # Chat-related tables
  ...                  # One file per logical concern
```

Features own their queries, not their tables — see [architecture-principles.md](architecture-principles.md#schema-ownership-vs-query-ownership) for why that split is forced rather than chosen.

---

## Feature Extension Mechanism

Complex features may need internal layering rules beyond the base set. A feature-scoped rule is an ordinary rule with a scoped id:

1. Namespace the id to the feature — `editor-boundary/no-canvas-sidebar-import` rather than `boundary/…` — and document it with the same field template the catalog's rules use. The diagnostic id is also the registration key, so the prefix is what tells a reader the rule is feature-scoped.
2. oxlint rules go in `lint/oxlint/<feature-tag>/` and are registered in `lint/oxlint/plugin.ts` like any other; structural checks are scoped to the feature's directory tree through their config roots.
3. The rule applies within that feature's directory and nowhere else.

Example: an editor feature might prevent canvas rendering code from importing sidebar components, enforcing communication through shared state rather than direct imports.
