# structure — File placement and naming

`topology` is the completeness check: every other rule governs paths it recognises, this one governs the paths nothing recognises. Several rules here are TanStack Start or Drizzle specific — keep the shape, repoint the API being matched.

| Rule | Mechanism | Blocking | What it prevents |
|---|---|---|---|
| [server-fn-placement](server-fn-placement.ts) | oxlint | Yes | `createServerFn` outside `controllers/` directories |
| [no-deprecated-input-validator](no-deprecated-input-validator.ts) | oxlint | Yes | Deprecated `.inputValidator()` calls on TanStack Start server functions and middleware |
| [no-plain-export-in-server-fn-module](no-plain-export-in-server-fn-module.ts) | oxlint | Yes | Runtime exports other than `createServerFn` and `createMiddleware` bridges in compiler-processed modules |
| [layer-direction](layer-direction.md) | Script | Yes | Within-feature layer direction violations (e.g., repo importing controllers), at any nesting depth and in either spelling. Consumes the import graph |
| [topology](topology.md) | Script | Yes | Files living where no rule looks — unlisted `src/` roots, modules at a feature root, routes reaching into infrastructure |
| [deprecated-paths](deprecated-paths.ts) | oxlint | Yes | Imports from removed/renamed paths (e.g., `@/components/*`) |
| [schema-placement](schema-placement.ts) | oxlint | Yes | Drizzle schema declarations (`pgTable`, `relations`) outside `infrastructure/db/schema/` |
| [server-fn-validation](server-fn-validation.ts) | oxlint | Yes | `createServerFn` chaining `.handler()` without `.validator()` |
| [no-raw-result](no-raw-result.ts) | oxlint | Yes | Returning unserializable Drizzle write results (`db.delete`, `.onConflictDoNothing`) without `.returning()` |

Adoption mechanics, the spec contract, and cross-tag rule selection: [../overview.md](../overview.md).
