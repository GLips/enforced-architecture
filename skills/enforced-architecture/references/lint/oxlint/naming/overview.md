# naming — Searchability and discoverability

Agents navigate a codebase by grepping symbol names more than by tracing imports or types, so names
are the primary index. These rules keep the public surface visible to plain text.

The per-file half — one rule, about what a declaration is called. What a *barrel* does to a name on
its way out is a whole-tree question:
[../../structural/naming/overview.md](../../structural/naming/overview.md).

| Rule | Blocking | What it prevents |
|---|---|---|
| [no-vacant-symbol-names](no-vacant-symbol-names.ts) | Yes | Declarations named for their container category (`shape`, `data`, `info`, `manager`, `helper`) instead of their role. Whole-word matching, so `reshape` and `metadata` are untouched |

Adoption mechanics, the spec contract, and cross-tag rule selection: [../../overview.md](../../overview.md).
