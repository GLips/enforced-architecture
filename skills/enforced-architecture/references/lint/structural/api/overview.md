# api — Public API surface and barrel conventions

The whole-tree half. Both checks below answer a question about a barrel that no single file
contains: what the barrel transitively pulls in, and whether the importee agreed to the edge. The
per-file rules that match a specifier's depth are in
[../../oxlint/api/overview.md](../../oxlint/api/overview.md).

| Rule | Blocking | What it prevents |
|---|---|---|
| [barrel-purity](barrel-purity.md) | Yes | Client-safe barrels transitively pulling in server-only packages |
| [feature-visibility](feature-visibility.md) | Mixed | Cross-feature imports the importee never granted. Ungranted edges block, stale grants warn. Consumes the import graph |

Adoption mechanics, the spec contract, and cross-tag rule selection: [../../overview.md](../../overview.md).
