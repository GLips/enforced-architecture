# naming — Searchability and discoverability

Agents navigate a codebase by grepping symbol names more than by tracing imports or types, so names are the primary index. These rules keep the public surface visible to plain text.

| Rule | Mechanism | Blocking | What it prevents |
|---|---|---|---|
| [barrel-discoverability](barrel-discoverability.md) | Script | Yes | Public barrels using `export *` or renamed re-exports (`export { X as Y }`) that hide or rename symbols from text search |
| [no-vacant-symbol-names](no-vacant-symbol-names.ts) | oxlint | Yes | Declarations named for their container category (`shape`, `data`, `info`, `manager`, `helper`) instead of their role. Whole-word matching, so `reshape` and `metadata` are untouched |
| [test-file-mirror](test-file-mirror.md) | Script | No | Test files whose names don't mirror their source, so they don't surface alongside the code they cover |

Adoption mechanics, the spec contract, and cross-tag rule selection: [../overview.md](../overview.md).
