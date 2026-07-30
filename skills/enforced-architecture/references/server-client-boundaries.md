# Server/Client Boundaries

TanStack Start-specific server/client conventions and enforcement. How to keep server-only code out of client bundles and structure files for correct bundle splitting.

---

## File Naming Convention

| Pattern | Convention | Environment |
|---|---|---|
| `*.server.ts` | Explicit server-only | Auto-denied from client bundles by TanStack Start's `**/*.server.*` import-protection pattern |
| `*.client.ts` | Explicit client-only | Auto-denied from server bundles |
| Regular `*.ts` | Both environments | TanStack Start compiler handles splitting for `createServerFn` |

**Key distinction:** The TanStack Start compiler runs before import protection. It replaces `createServerFn` handler bodies with client RPC stubs and prunes server-only imports that become unused after the rewrite. Import protection then checks only what survives compilation.

The `.server.ts` convention is not just a naming hint — TanStack Start actively prevents any client-side import chain from reaching these files if server-only code survives compilation. Reserve `.server.ts` for files with raw server-only code (DB connections, secrets, auth internals) that should never appear in a client import chain.

### `createServerFn` Files Must NOT Use `.server.ts`

Files that export `createServerFn()` must use plain `.ts`. The compiler replaces handler bodies with client RPC stubs and prunes imports used only inside the handler. Top-level code and sibling exports remain client code.

Controller files are named without `.server.ts` — e.g., `controllers/jobs.ts` not `controllers/jobs.server.ts`. They contain `createServerFn` exports and are re-exported through the feature's `index.ts` barrel.

Source: `@tanstack/start-plugin-core/src/start-compiler/handleCreateServerFn.ts`.

### `createMiddleware` Files

TanStack Start compiles middleware for the client, removing `.server()` and `.validator()` calls. Request middleware uses `.server()` only. Server-function middleware may use both `.client()` and `.server()`, so its definition must remain client-importable.

Use plain `.ts` for middleware that is imported by server functions or has a `.client()` phase. Put raw server-only helpers in `.server.ts` modules and call them only from `.server()` callbacks.

**Do not co-locate `createMiddleware` with `createServerFn`.** On the client a server function is replaced wholesale by an RPC stub, so everything its body referenced goes with it; middleware only loses its `.server()` and `.validator()` calls and otherwise stays live. Both then share one dead-code pass, so a server-only import the two had in common can survive — observed as `better-auth` pulling Node's `Buffer` into the browser. Enforced by `structure/middleware-colocation`.

Source: `@tanstack/start-plugin-core/src/start-compiler/handleCreateMiddleware.ts`, `handleCreateServerFn.ts`, `compiler.js`.

---

## Where `.server.ts` Is Used

These file categories must use `.server.ts` naming:

| Category | Example | Why |
|---|---|---|
| Server-only env vars | `env.server.ts` | API keys, DB URLs, secrets |
| Raw auth infrastructure | `infrastructure/auth/auth-instance.server.ts` | Auth config, DB adapter, secrets |
| Feature server-only barrels | `features/<name>/index.server.ts` | Cross-feature server-only API (DB access, secrets, internals) |
| Server function handler implementations | `controllers/items.server.ts` | Server-only companion for a client-importable server-function definition |
| SDK wrappers with secrets | `infrastructure/integrations/<service>.ts` | Denied via import protection config, not naming |

Server-only infrastructure modules that do not use the `.server.ts` naming convention are instead denied from client bundles via the import protection configuration in `vite.config.ts`. Both mechanisms achieve the same result — the choice depends on whether the module needs per-file naming or directory-level denial.

## Where `.server.ts` Is NOT Used

| Category | Why regular `.ts` | How splitting works |
|---|---|---|
| Controller files (`createServerFn`) | Compiler prunes imports used only inside handler bodies | Top-level code and sibling exports remain client code |
| DB schema definitions | Types only, no runtime connection | Denied from client via import protection on `infrastructure/db/**` |
| Shared types/interfaces | Erased at compile time | No runtime code to protect |
| Feature `index.ts` barrels | Export server fn references (client-safe stubs) | Barrel must not import from `index.server.ts` |

---

## Feature Barrel Naming Convention

Each feature has two barrels that control the server/client boundary:

| File | Environment | Exports | Import pattern |
|---|---|---|---|
| `index.ts` | Client-safe | `createServerFn` RPC bridges, types, constants, safe metadata | `@/features/<name>` |
| `index.server.ts` | Server-only | Raw server code: DB access, repo modules, secrets, internals | `@/features/<name>/index.server` |

**Why `index.server.ts` instead of `server.ts`:**

The `index.server.ts` naming is automatically caught by vite's `**/*.server.*` import-protection pattern. This means:
- No need for additional `src/**/server.ts` or `src/**/server.tsx` file patterns in the import protection config
- The server-only nature is obvious at a glance from the filename
- The barrel naming is consistent: `index.ts` (client) and `index.server.ts` (server) — both resolve from the same directory

**Barrel direction rule:** `index.ts` must NEVER import from `index.server.ts`. `index.server.ts` may re-export from `index.ts`. Violating this pulls server-only code into client bundles.

**Route imports use the feature barrel:** Routes import from `@/features/<name>` (resolves to `index.ts`), not from deep paths like `@/features/<name>/controllers/jobs`. This avoids triggering both the biome deep-import rule and vite import-protection.

---

## Server Function Pattern

TanStack Start's compiler removes `createServerFn` handler bodies from client bundles. Imports used only by those bodies are pruned.

### Single-File Pattern

Controller files may import infrastructure, repos, and auth for use inside handlers:

```typescript
// features/chat/controllers/conversations.ts
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSession } from "@/infrastructure/auth/require-session.server";
import { db } from "@/infrastructure/db/client";
import { conversationRepo } from "../repo/conversations";

const loadConversationSchema = z.object({
  conversationId: z.string(),
});

export const loadConversationFn = createServerFn({ method: "GET" })
  .validator(loadConversationSchema)
  .handler(async ({ data }) => {
    const session = await requireSession();

    const conv = await conversationRepo.getActiveByIdForUser(db, {
      conversationId: data.conversationId,
      userId: session.user.id,
    });

    if (!conv) {
      throw new Error("Conversation not found or access denied");
    }

    return {
      id: conv.id,
      title: conv.title,
      messages: conv.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
      })),
    };
  });
```

### Two-File Split

Use a client-importable controller for the direct, top-level `createServerFn` definition and a `.server.ts` companion for raw server-only helpers.

```typescript
// controllers/conversations.ts — createServerFn definition (client-safe)
export const loadConversationFn = createServerFn({ method: "GET" })
  .validator(loadConversationSchema)
  .handler(async ({ data }) => {
    const { loadConversation } = await import("./conversations.server");
    return loadConversation(data);
  });
```

```typescript
// controllers/conversations.server.ts — handler implementation (server-only)
import "@tanstack/react-start/server-only";
import { requireSession } from "@/infrastructure/auth/require-session.server";
import { db } from "@/infrastructure/db/client";
import { conversationRepo } from "../repo/conversations";

export async function loadConversation(input: { conversationId: string }) {
  // ... implementation
}
```

The dynamic `await import()` inside the handler body gets extracted along with the handler, so the `.server.ts` file never enters the client bundle. Use `import "@tanstack/react-start/server-only"` as a safety guard in the companion file.

### Conventions

- `method: "GET"` for reads, `method: "POST"` for mutations
- `.validator(zodSchema)` on every function that accepts input
- Auth via `requireSession()` from `@/infrastructure/auth/require-session.server`
- Return plain serializable objects (no Drizzle query builders, no class instances)
- Throw typed errors for business failures
- Controller files use plain `.ts` — the compiler prunes server-only imports from `createServerFn` handlers

---

## Framework Import Protection (vite.config.ts)

TanStack Start provides configurable import protection via the Vite plugin. This is the framework-level enforcement boundary.

```typescript
const startImportProtection = {
  behavior: "error" as const,
  client: {
    specifiers: [
      "@/env.server",                    // Server environment variables
      "@/infrastructure/db/**",          // Database modules
      "@/infrastructure/integrations/**", // SDK adapters with secrets
      "@/infrastructure/telemetry/**",   // Server-only telemetry
      // Add paths for infrastructure modules with server-only config
    ],
    files: [
      "**/*.server.*",                   // All .server.ts/.server.tsx files
                                         // (catches index.server.ts barrels, env.server.ts,
                                         //  controller impl files, auth helpers, etc.)
      "src/infrastructure/db/**",
      "src/infrastructure/integrations/**",
      "src/infrastructure/telemetry/**",
      // Mirror the specifiers above with file patterns
    ],
  },
  server: { files: [] },
};

tanstackStart({
  importProtection: startImportProtection,
});
```

### What Import Protection Catches

- Any client-side code importing from `infrastructure/db/` -- full import trace in error
- Any client-side code importing `.server.ts` files (including `index.server.ts` barrels)
- Any client-side code importing infrastructure modules with secrets

### What Import Protection Does NOT Catch

- Feature A importing Feature B's internals (architecture GritQL rules handle this)
- Layer direction violations within features (GritQL rules handle this)
- SDK containment violations (GritQL rules handle this)
- Cross-boundary alias violations (GritQL rules handle this)

---

## Two Boundaries

Two enforcement mechanisms protect the server/client split. They serve different purposes and overlap only on DB isolation.

### Boundary 1: Framework-level (bundler)

Server-only code must not leak into client bundles. Enforced by TanStack Start's import protection and `.server.ts` file denial. Runs during `dev` and `build`. Produces build errors with full import traces.

**Primary for:** DB connection isolation, API key protection, SDK secret containment.

### Boundary 2: Architecture-level (GritQL + structural scripts)

Layers must respect the dependency direction graph. Enforced by Biome GritQL rules (per-file) and structural scripts (cross-file). Runs in editor (GritQL only), pre-commit, and CI.

**Primary for:** Feature encapsulation, public API enforcement, layer direction, cross-boundary alias requirement, cycle detection.

### Where They Overlap

DB isolation is enforced by both:
- Framework import protection denies `infrastructure/db/**` from client bundles (runtime safety)
- The `boundary/db-isolation` rule denies DB imports from non-repo/non-controller files (architectural correctness)

The framework catches "this code would leak secrets." The architecture rules catch "this code is in the wrong layer." Both must pass.

---

## Client-Safe Infrastructure

Most infrastructure modules are server-only. Only designated modules are explicitly client-safe and importable from UI code (e.g., a browser-side auth client or query client setup). All other infrastructure imports from client contexts are violations, enforced by the `boundary/client-server-infra` rule. When adding a new client-safe infrastructure module, update both the import protection config and that rule's allowlist.

---

## Route Data Loading

TanStack Router routes use `loader` to prefetch data. The loader calls server functions imported from feature public APIs:

```typescript
// routes/_authed/items/$groupId.tsx
import { createFileRoute } from "@tanstack/react-router";
import { loadItemsFn } from "@/features/items";

export const Route = createFileRoute("/_authed/items/$groupId")({
  loader: async ({ params }) => {
    await loadItemsFn({ data: { groupId: params.groupId } });
  },
  component: ItemsPage,
});
```

Routes import from client-safe feature barrels (`@/features/<name>`) or feature UI (`@/features/<name>/ui/Component`), never from server-only barrels or other feature internals.
