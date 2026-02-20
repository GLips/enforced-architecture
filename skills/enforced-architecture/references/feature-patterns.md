# Feature Patterns

Feature scaling patterns, internal structure, layer occupancy, and public API conventions. This is the reference for designing and evolving features within the enforced architecture.

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

**Skip absent layers, never bypass present ones.**

| Layers present | Valid call paths | Invalid |
|---|---|---|
| `controllers` only | `controllers -> infrastructure`, `controllers -> domains` | -- |
| `controllers`, `repo` | `controllers -> repo -> infrastructure` | `controllers -> infrastructure/db/schema` (repo exists, must use it) |
| `controllers`, `service`, `repo` | `controllers -> service -> repo -> infrastructure` | `controllers -> repo` (service exists, must use it) |
| `controllers`, `service` (no repo) | `controllers -> service -> infrastructure` | -- |
| `ui`, `controllers` | `ui -> controllers` | `ui -> infrastructure` |

When a layer is added, enforcement tightens automatically. Adding `repo/` to a feature that previously had `controllers/` accessing the DB directly means all DB access must now route through `repo/`. This is enforced by the `boundary/layer-occupancy` check.

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
- Validate input (via Zod schemas on `.validator()` or `.inputValidator()`)
- Check authorization (via session helpers from infrastructure)
- Orchestrate calls to service/repo/domain layers
- Return plain serializable objects
- Throw typed errors for business failures

Controllers do NOT:
- Import UI code, route code, or other features' internals
- Import other features except through public API barrels
- Contain pure business logic (that belongs in `domains/`)
- Contain raw DB queries when a `repo/` directory exists (the `boundary/layer-occupancy` check enforces this)

### Controller File Naming

Controller files are named without the `.server.ts` suffix — e.g., `controllers/items.ts` not `controllers/items.server.ts`. They contain `createServerFn` exports that produce RPC bridges. On the client, the compiler replaces handler bodies with network call stubs. Routes and UI code **need** to import these files to get the stub. The `.server.ts` suffix would trigger vite's `**/*.server.*` import-protection and block that import. This mistake is caught by the `structure/server-fn-naming` rule.

Controllers are re-exported through the feature's `index.ts` barrel:

```typescript
// features/<name>/index.ts
export { loadItemFn, createItemFn } from "./controllers/items";
```

### Server Function Pattern

TanStack Start's compiler extracts `createServerFn` handler bodies and their dependency graph from client bundles. Server-only imports at the top of the file are handled by the compiler — they only exist in the server bundle. This means controller files can directly import infrastructure, repos, and auth:

```typescript
// controllers/items.ts
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSession } from "@/infrastructure/auth/require-session.server";
import { db } from "@/infrastructure/db/client";
import { itemRepo } from "../repo/items";

export const loadItemFn = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const session = await requireSession();
    return itemRepo.getById(db, { id: data.id, userId: session.user.id });
  });
```

### Two-File Split (Escape Hatch)

For standard controllers — files with direct top-level imports and straightforward `createServerFn` usage — the compiler handles everything. Trampolines and dynamic imports are unnecessary and add complexity for no benefit.

The only known failure mode is abstracting around `createServerFn` itself: wrapping it in helper functions, passing it through intermediaries, or building factory patterns on top of it. The TanStack maintainer explicitly says this is unsupported — the compiler expects direct, top-level `createServerFn` calls.

If you encounter a case where the compiler fails to extract server-only imports from the client bundle (build errors pointing at server-only code in client output), the two-file split is a fallback. Do not reach for it proactively.

```
controllers/
  items.ts               # createServerFn definitions (client-safe)
  items.server.ts        # Handler implementations (server-only)
```

```typescript
// controllers/items.ts
export const loadItemFn = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const { loadItem } = await import("./items.server");
    return loadItem(data);
  });
```

```typescript
// controllers/items.server.ts
import "@tanstack/react-start/server-only";
import { requireSession } from "@/infrastructure/auth/require-session.server";
import { db } from "@/infrastructure/db/client";
import { itemRepo } from "../repo/items";

export async function loadItem(input: { id: string }) {
  const session = await requireSession();
  return itemRepo.getById(db, { id: input.id, userId: session.user.id });
}
```

The `.server.ts` companion holds the implementation with all server-only imports. The dynamic `await import()` inside the handler body gets extracted along with the handler, so the `.server.ts` file never enters the client bundle. Use `import "@tanstack/react-start/server-only"` as a safety guard in the companion file.

---

## Public API Barrels

Every feature exposes its public API through barrel files. External consumers import through these -- never deeper.

### `index.ts` (Client-Safe)

Exports types, constants, pure helpers, createServerFn references, and UI component re-exports. Safe to import from anywhere including client bundles.

```typescript
// features/chat/index.ts

// Server function references (client-safe -- TanStack Start replaces with RPC stubs)
export {
  chatStreamFn,
  ServerFnChatTransport,
} from "./controllers/chat-stream";
export {
  deleteConversationFn,
  listConversationsFn,
  loadConversationFn,
  type PersistedMessage,
  renameConversationFn,
  toUIMessages,
} from "./controllers/conversations";
// Errors
export {
  ChatError,
  type ChatErrorCode,
  getDisplayErrorMessage,
} from "./errors";
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

### Barrel Direction Rule

`index.server.ts` may re-export from `index.ts`. `index.ts` must NEVER import from `index.server.ts`. This is enforced by the `api/barrel-direction` and `api/server-import-context` rules.

Violating this rule pulls server-only code into client bundles through the `index.ts` barrel.

---

## Cross-Feature Communication

Features import other features ONLY through public API barrels:

```
@/features/<other-feature>                  # Client-safe barrel (types, server fn references)
@/features/<other-feature>/index.server     # Server-only barrel (repos, raw queries)
@/features/<other-feature>/ui/*             # UI components (routes only, not other features)
```

Forbidden cross-feature imports:

```
@/features/<other-feature>/controllers/*  # Internal implementation detail
@/features/<other-feature>/service/*      # Internal implementation detail
@/features/<other-feature>/repo/*         # Internal implementation detail
```

Enforcement: the `api/feature-public-api` rule blocks all deep cross-feature imports except `index.server` and `ui/*`. Routes get the `ui/*` exception because they compose feature UI. Other features do not.

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

Features own their repo modules (query behavior) and controllers (API surface). The schema is shared infrastructure. Migration tooling scans one directory. Cross-domain foreign keys require centralization. Drizzle relations reference tables from multiple files.

---

## Feature Extension Mechanism

Complex features may need internal layering rules beyond the base set. When adding feature-specific rules:

1. Document the rule with the same field template used for base rules
2. Namespace the rule ID to the feature: `GQ-EDITOR-01` for GritQL, `ST-EDITOR-01` for structural
3. Add GritQL rules to `biome/` with the feature namespace prefix
4. Scope structural checks to the feature's directory tree in the orchestrator script
5. The rule only applies within that feature's directory

Example: an editor feature might prevent canvas rendering code from importing sidebar components, enforcing communication through shared state rather than direct imports.
