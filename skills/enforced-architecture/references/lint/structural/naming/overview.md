# naming — Searchability and discoverability

The whole-tree half: both checks compare a name against something outside the file that carries it
— a barrel's re-export against the symbol it renames, a test filename against the source it should
mirror. The per-file half is in [../../oxlint/naming/overview.md](../../oxlint/naming/overview.md).

| Rule | Blocking | What it prevents |
|---|---|---|
| [barrel-discoverability](barrel-discoverability.md) | Yes | Public barrels using `export *` or renamed re-exports (`export { X as Y }`) that hide or rename symbols from text search |
| [test-file-mirror](test-file-mirror.md) | No | Test files whose names don't mirror their source, so they don't surface alongside the code they cover |

Adoption mechanics, the spec contract, and cross-tag rule selection: [../../overview.md](../../overview.md).
