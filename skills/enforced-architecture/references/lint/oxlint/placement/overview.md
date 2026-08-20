# placement — Where code may live

`placement/` is about the address a file has; [`boundary/`](../boundary/overview.md) is about what
it may import from there.

The per-file half. Each rule below recognises a shape in one file and says it is in the wrong
directory. The completeness check that governs the paths *nothing* recognises is on the other side:
[../../structural/placement/overview.md](../../structural/placement/overview.md).

Several rules here are TanStack Start or Drizzle specific — keep the shape, repoint the API being
matched.

| Rule | Blocking | What it prevents |
|---|---|---|
| [server-fn-placement](server-fn-placement.ts) | Yes | `createServerFn` outside `controllers/` directories |
| [no-deprecated-input-validator](no-deprecated-input-validator.ts) | Yes | Deprecated `.inputValidator()` calls on TanStack Start server functions and middleware |
| [no-plain-export-in-server-fn-module](no-plain-export-in-server-fn-module.ts) | Yes | Runtime exports other than `createServerFn` and `createMiddleware` bridges in compiler-processed modules |
| [deprecated-paths](deprecated-paths.ts) | Yes | Imports from removed/renamed paths (e.g., `@/components/*`) |
| [schema-placement](schema-placement.ts) | Yes | Drizzle schema declarations (`pgTable`, `relations`) outside `infrastructure/db/schema/` |
| [server-fn-validation](server-fn-validation.ts) | Yes | `createServerFn` chaining `.handler()` without `.validator()` |
| [no-raw-result](no-raw-result.ts) | Yes | Returning unserializable Drizzle write results (`db.delete`, `.onConflictDoNothing`) without `.returning()` |

Adoption mechanics, the spec contract, and cross-tag rule selection: [../../overview.md](../../overview.md).
