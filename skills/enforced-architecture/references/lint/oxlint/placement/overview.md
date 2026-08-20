# placement — Where code may live

`placement/` is about the address a file has; [`boundary/`](../boundary/overview.md) is about what
it may import from there.

The per-file half. Each rule below recognises a shape in one file and says it is in the wrong
directory. The completeness check that governs the paths *nothing* recognises is on the other side:
[../../structural/placement/overview.md](../../structural/placement/overview.md).

Several rules here are TanStack Start or Drizzle specific — keep the shape, repoint the API being
matched.

| Rule | Blocking | What it buys |
|---|---|---|
| [server-fn-placement](server-fn-placement.ts) | Yes | Every endpoint a feature exposes is in one directory, the imports of the factory included |
| [no-deprecated-input-validator](no-deprecated-input-validator.ts) | Yes | One spelling of the validator method, thus a search for `.validator(` finds every checked chain |
| [no-plain-export-in-server-fn-module](no-plain-export-in-server-fn-module.ts) | Yes | No sibling runtime export reaches the browser from a compiler-processed module |
| [deprecated-paths](deprecated-paths.ts) | Yes | A removed directory stays removed, and the next import of the old path gets the name of its replacement |
| [schema-placement](schema-placement.ts) | Yes | One directory holds every table, thus a migration generate run covers all of them |
| [server-fn-validation](server-fn-validation.ts) | Yes | Client input reaches a handler only after a schema checks it |
| [no-raw-result](no-raw-result.ts) | Yes | No Drizzle write result reaches the RPC serializer, which throws on one at run time |

Adoption mechanics, the spec contract, and cross-tag rule selection: [../../overview.md](../../overview.md).
