# Server/Client Boundaries

TanStack Start-specific server/client conventions and enforcement. How to keep server-only code out of client bundles and structure files for correct bundle splitting.

---

## File Naming Convention

| Pattern | Convention | Environment |
|---|---|---|
| `*.server.ts` | Explicit server-only | Auto-denied from client bundles by TanStack Start |
| `*.client.ts` | Explicit client-only | Auto-denied from server bundles |
| Regular `*.ts` | Both environments | TanStack Start compiler handles splitting for `createServerFn` |

**Key distinction:** Files containing `createServerFn` calls are regular `.ts` because the compiler replaces server handlers with RPC stubs on the client. Files with raw server-only code (DB connections, API keys, SDK configs, auth wrappers) use `.server.ts` for automatic denial.

The `.server.ts` convention is not just a naming hint -- TanStack Start actively prevents any client-side import chain from reaching these files. Attempting it produces a build error with a full import trace.

---

## Where `.server.ts` Is Used

These file categories must use `.server.ts` naming:

| Category | Example | Why |
|---|---|---|
| Server-only env vars | `env.server.ts` | API keys, DB URLs, secrets |
| Auth infrastructure | `infrastructure/auth/require-session.server.ts` | Session management, encryption |
| Feature server barrels | `features/<name>/server.ts` | Cross-feature server-only API |
| Server function implementations | `controllers/server-fns.server.ts` | Raw DB access, auth checks, SDK calls |
| SDK wrappers with secrets | `infrastructure/integrations/<service>.ts` | Denied via import protection config, not naming |

Server-only infrastructure modules that do not use the `.server.ts` naming convention are instead denied from client bundles via the import protection configuration in `vite.config.ts`. Both mechanisms achieve the same result -- the choice depends on whether the module needs per-file naming or directory-level denial.

---

## Where `.server.ts` Is NOT Used

| Category | Why regular `.ts` | How splitting works |
|---|---|---|
| Server function definitions (`createServerFn`) | Compiler replaces handler with RPC stub on client | The `.ts` file is safe; the `.server.ts` companion holds implementations |
| DB schema definitions | Types only, no runtime connection | Denied from client via import protection on `infrastructure/db/**` |
| Shared types/interfaces | Erased at compile time | No runtime code to protect |
| Feature `index.ts` barrels | Export server fn references (client-safe stubs) | Barrel must not import from `server.ts` |

---

## Server Function Pattern

TanStack Start server functions use a two-file split. The `.ts` file defines the RPC shape. The `.server.ts` file contains the implementation with server-only imports.

### The `.ts` file (client-safe)

```typescript
// features/<name>/controllers/server-fns.ts
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const loadConversationSchema = z.object({
  conversationId: z.string(),
});

export const loadConversationFn = createServerFn({ method: "GET" })
  .inputValidator(loadConversationSchema)
  .handler(async ({ data }) => {
    const { loadConversation } = await import("./server-fns.server");
    return loadConversation(data);
  });
```

### The `.server.ts` file (server-only)

```typescript
// features/<name>/controllers/server-fns.server.ts
import "@tanstack/react-start/server-only";
import { requireSession } from "@/infrastructure/auth/require-session.server";
import { db } from "@/infrastructure/db/client";
import { conversationRepo } from "../repo/conversations";

export async function loadConversation(input: { conversationId: string }) {
  const session = await requireSession();

  const conv = await conversationRepo.getActiveByIdForUser(db, {
    conversationId: input.conversationId,
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
}
```

### Conventions

- `method: "GET"` for reads, `method: "POST"` for mutations
- `.inputValidator(zodSchema)` on every function that accepts input
- `import "@tanstack/react-start/server-only"` at the top of every `.server.ts` file
- Auth via `requireSession()` from `@/infrastructure/auth/require-session.server`
- Return plain serializable objects (no Drizzle query builders, no class instances)
- Throw typed errors for business failures
- Dynamic `await import("./server-fns.server")` bridges the two files

---

## Framework Import Protection (vite.config.ts)

TanStack Start provides configurable import protection via the Vite plugin. This is the framework-level enforcement boundary.

```typescript
const startImportProtection = {
  behavior: "error" as const,
  client: {
    specifiers: [
      "@/domains/*/server",              // Server-only domain barrels
      "@/features/*/server",             // Server-only feature barrels
      "@/env.server",                    // Server environment variables
      "@/infrastructure/db/**",          // Database modules
      "@/infrastructure/integrations/**", // SDK adapters with secrets
      "@/infrastructure/telemetry/**",   // Server-only telemetry
      // Add paths for infrastructure modules with server-only config
    ],
    files: [
      "**/*.server.*",                   // All .server.ts files
      "src/**/server.ts",                // All server barrels
      "src/**/server.tsx",
      "src/env.server.ts",
      "src/infrastructure/db/**",
      "src/infrastructure/integrations/**",
      "src/infrastructure/telemetry/**",
      // Mirror the specifiers above with file patterns
    ],
  },
  server: { files: [] },
};

tanstackStart({
  importProtection: {
    ...startImportProtection,
    // Suppress false positives on infrastructure imports from API routes.
    // TanStack Start traces import chains from route files and warns when
    // server-only files are reached. API routes (e.g., routes/api/auth/$.tsx)
    // legitimately import infrastructure through their server function chains.
    // Infrastructure is server-only by design, and the framework's
    // `server: { handlers }` pattern correctly tree-shakes these imports
    // from client bundles.
    ignoreImporters: [/\/infrastructure\//],
  },
});
```

### What Import Protection Catches

- Any client-side code importing from `infrastructure/db/` -- full import trace in error
- Any client-side code importing `.server.ts` files
- Any client-side code importing server barrels (`features/*/server.ts`)
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

Routes import from feature barrels (`@/features/<name>` or `@/features/<name>/server`), never from feature internals. Routes may also import feature UI directly (`@/features/<name>/ui/Component`). These are the only three valid import patterns from routes into features.
