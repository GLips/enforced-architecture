# health — Code quality metrics

The per-file half — one rule. The counts that need a file set or a word ceiling are in
[../../structural/health/overview.md](../../structural/health/overview.md).

| Rule | Blocking | What it prevents |
|---|---|---|
| [no-nested-ternary](no-nested-ternary.ts) | Yes | Ternary expressions nested 3+ levels deep (extract to variables or helpers) |

Adoption mechanics, the spec contract, and cross-tag rule selection: [../../overview.md](../../overview.md).
