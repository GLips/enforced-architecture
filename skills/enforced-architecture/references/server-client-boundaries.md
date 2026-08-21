# Server and Client Boundaries

TanStack Start conventions for keeping server-only code out of client bundles, and how they divide
work with the catalog's rules.

---

## File Naming

| Pattern | Meaning | How it is fenced |
|---|---|---|
| `*.server.ts` | Server-only | TanStack Start denies it from client bundles through the `**/*.server.*` import-protection pattern |
| `*.client.ts` | Client-only | Denied from server bundles the same way |
| plain `*.ts` | Both | The compiler splits `createServerFn` for you |

**The compiler runs before import protection.** It replaces `createServerFn` handler bodies with
client RPC stubs and prunes the imports that become unused after the rewrite. Import protection then
checks only what survives. That ordering is why a controller may import the database at the top of
the file and still ship a clean client bundle.

Reserve `.server.ts` for files holding raw server-only code: database connections, secrets, auth
internals.

### A `createServerFn` file must not use `.server.ts`

A file exporting `createServerFn()` uses a plain `.ts` name. Its RPC reference has to stay
client-importable, and the compiler has already pruned the handler's imports by the time protection
runs. So `controllers/jobs.ts`, never `controllers/jobs.server.ts`, re-exported through the feature's
`index.ts`. Source: `@tanstack/start-plugin-core/src/start-compiler/handleCreateServerFn.ts`.

**Nothing enforces this.** `placement/server-fn-placement` checks the directory and ignores the
suffix, and `placement/no-plain-export-in-server-fn-module` returns early on any `.server` file. A
`createServerFn` in a `.server.ts` file passes the whole catalog and breaks the client bundle. It
belongs in the project's CLAUDE.md.

### `createMiddleware` files

TanStack Start compiles middleware for the client, removing `.server()` and `.validator()` calls.
Request middleware uses `.server()` only. Server-function middleware may use both `.client()` and
`.server()`, so its definition has to stay client-importable.

Use a plain `.ts` name for middleware that a server function imports or that has a `.client()` phase.
Put raw server-only helpers in `.server.ts` modules and call them from inside `.server()` callbacks.
Source: `@tanstack/start-plugin-core/src/start-compiler/handleCreateMiddleware.ts`.

---

## Where `.server.ts` Belongs

| Category | Example |
|---|---|
| Server-only env | `env.server.ts` |
| Raw auth internals | `infrastructure/auth/auth-instance.server.ts` |
| A feature's server-only barrel | `features/<name>/index.server.ts` |
| A handler implementation split out of a controller | `controllers/items.server.ts` |
| The database schema barrel | `infrastructure/db/schema/index.server.ts` |

A server-only module that does not carry the suffix is denied from client bundles by the import
protection config instead. Both routes reach the same result. **Prefer the name.** Every `.server.ts`
file is one less entry the hand-maintained deny list has to remember, and that list blocks only what
someone thought to add.

Two traps when configuring or renaming:

- **A user-supplied `client.files` array replaces the framework default rather than extending it**
  (`pick = (user, fallback) => user ? [...user] : [...fallback]` in the import-protection plugin). A
  custom list must repeat `**/*.server.*` explicitly, or the entire naming fence turns off silently.
  `client.specifiers` merges additively; `files` does not.
- **Renaming a module to `.server.ts` breaks references typecheck cannot see.** A config file that
  points at it by filesystem path — a Drizzle config's `schema:` entry, for instance — keeps the old
  path. Grep for the old path as a string, not only as an import specifier.

`.server.ts` is not needed for a controller file (the compiler prunes the handler's imports), a
schema leaf module (types only, and the directory is denied by config), a shared type (erased at
compile time), or a feature's `index.ts` barrel (which exports client-safe RPC references).

---

## The Two Barrels

| File | Environment | Holds | Import pattern |
|---|---|---|---|
| `index.ts` | Client-safe | RPC references, types, constants | `@/features/<name>` |
| `index.server.ts` | Server-only | Raw server code, repo modules, internals | `@/features/<name>/index.server` |

**`index.server.ts`, not `server.ts`,** because `**/*.server.*` already catches it. The naming fence
covers the barrel for free rather than costing another pattern in the protection config, and the two
files resolve from the same directory.

What each barrel holds, which direction re-exports may run, and which callers may name the server
one: [feature-patterns.md](feature-patterns.md#public-api-barrels).

---

## The Server Function Pattern

The compiler removes `createServerFn` handler bodies from client bundles, and prunes the imports only
those bodies used.

### One file

A controller may import infrastructure, repos and auth for use inside a handler:

```typescript
// features/chat/controllers/conversations.ts
import { createServerFn } from "@tanstack/react-start";
import { requireSession } from "@/infrastructure/auth/require-session.server";
import { db } from "@/infrastructure/db/client";
import { conversationRepo } from "../repo/conversations";

export const loadConversationFn = createServerFn({ method: "GET" })
  .validator(loadConversationSchema)
  .handler(async ({ data }) => {
    const session = await requireSession();
    const conv = await conversationRepo.getActiveByIdForUser(db, {
      conversationId: data.conversationId,
      userId: session.user.id,
    });
    if (!conv) throw new ChatError("not_found");
    return { id: conv.id, title: conv.title, messages: conv.messages };
  });
```

Every import above is server-only, and none reaches the client: each is used only inside the handler
body the compiler extracts.

### Two files

Split when the handler grows past what belongs in a client-importable file. The definition stays in a
plain `.ts` file and loads its implementation dynamically:

```typescript
// controllers/conversations.ts
export const loadConversationFn = createServerFn({ method: "GET" })
  .validator(loadConversationSchema)
  .handler(async ({ data }) => {
    const { loadConversation } = await import("./conversations.server");
    return loadConversation(data);
  });
```

```typescript
// controllers/conversations.server.ts
import "@tanstack/react-start/server-only";
import { requireSession } from "@/infrastructure/auth/require-session.server";

export async function loadConversation(input: { conversationId: string }) {
  // ...
}
```

The dynamic `import()` inside the handler is extracted with the handler, so the `.server.ts` file
never enters the client bundle. Use `import "@tanstack/react-start/server-only"` in the companion as
a guard.

**Conventions:** `method: "GET"` for reads and `"POST"` for mutations; `.validator(schema)` on every
function that takes input; auth through a session helper from infrastructure; return plain
serializable objects, never a query builder or a class instance; throw a typed error on a business
failure.

---

## Framework Import Protection

```typescript
const startImportProtection = {
  behavior: "error" as const,
  client: {
    specifiers: [
      "@/env.server",
      "@/infrastructure/db/**",
      "@/infrastructure/integrations/**",
      "@/infrastructure/telemetry/**",
    ],
    files: [
      "**/*.server.*",              // Keep this entry. A custom list replaces the default.
      "src/infrastructure/db/**",
      "src/infrastructure/integrations/**",
      "src/infrastructure/telemetry/**",
    ],
  },
  server: { files: [] },
};

tanstackStart({ importProtection: startImportProtection });
```

It catches any client-side import chain that reaches the database, a `.server.*` file, or an
infrastructure module holding secrets, and it reports the full trace. It does not catch anything that
is an architectural question rather than a leakage one: feature encapsulation, layer direction, SDK
containment, the alias requirement.

---

## Two Boundaries

Two mechanisms protect the split, and they answer different questions.

- **The bundler.** Import protection plus `.server.*` denial, running during `dev` and `build`,
  failing with a full import trace. It is primary for connection isolation, API key protection and
  SDK secret containment.
- **The catalog.** oxlint rules and structural checks, running in the editor, at pre-commit and in
  CI. Primary for feature encapsulation, public API enforcement, layer direction, the alias
  requirement and cycle detection.

They overlap in several places, and the overlap is deliberate rather than redundant. The bundler asks
"would this ship a secret?" The rule asks "is this file in the wrong layer?" A `.server.*` file
imported from a route trips both. `@/env.server` in a route trips both. The database imported from
UI trips both.

The clearest case is the database. Import protection denies `infrastructure/db/**` from client
bundles. `boundary/db-isolation` denies a database import from anywhere except three positions:
`infrastructure/`, a feature's `repo/`, and a feature's `controllers/`. A repo module importing the
database is fine to the rule and fine to the bundler. A `service/` module importing it is fine to the
bundler and denied by the rule. Both have to pass.

---

## Client-Safe Infrastructure

Infrastructure is server-only by default. Exactly two modules are client-safe: a browser auth client
and a query client. Every other infrastructure import from a client context is a violation. —
[boundary/client-server-infra](lint/oxlint/boundary/client-server-infra.ts)

**That list is a hand-written constant in the rule, and it is the one such list in the catalog.**
Every entry matches a specifier exactly, so no entry admits a subtree. Extending it is a source edit
to the rule, not a config value — which is deliberate, because a config field here would be an
adopter-extensible exemption. When a project genuinely gains a third client-safe module, add it in
both places: the rule's list and the import protection config.

---

## Route Data Loading

A route loads data through a server function imported from a feature's client-safe barrel:

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

**A loader is a client context.** It runs on the server for the first request and in the browser on
every client-side navigation, from the same shared load path. So a route imports
`@/features/<name>` or `@/features/<name>/ui/Component`, and never a server-only barrel — unless the
route file names itself `*.server.ts`.
