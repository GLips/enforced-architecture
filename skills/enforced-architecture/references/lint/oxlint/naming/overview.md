# naming — Searchability and discoverability

Agents navigate a codebase by grepping symbol names more than by tracing imports or types, so names
are the primary index. These rules keep the public surface visible to plain text.

The per-file half — one rule, about what a declaration is called. What a *barrel* does to a name on
its way out is a whole-tree question:
[../../structural/naming/overview.md](../../structural/naming/overview.md).

| Rule | Blocking | What it buys |
|---|---|---|
| [no-vacant-symbol-names](no-vacant-symbol-names.ts) | Yes | Every name another file can reach — a type, and a function, class or constant at module level — says what the thing is for |

Adoption mechanics, the spec contract, and cross-tag rule selection: [../../overview.md](../../overview.md).
