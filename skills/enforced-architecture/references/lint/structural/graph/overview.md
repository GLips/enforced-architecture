# graph — Cross-file dependency analysis

Structural-only: every question here is about edges between files, so there is nothing a per-file
rule could answer. `import-graph` is not a rule — it is the substrate the others read, and the
first thing to stand up.

| Rule | Blocking | What it prevents |
|---|---|---|
| [import-graph](import-graph.md) | — | Not a rule: the resolved import graph every graph-reading rule consumes instead of matching import strings. Build it first |
| [domain-cycles](domain-cycles.md) | Yes | Circular dependencies between domains |
| [feature-deps](feature-deps.md) | Mixed | Cycles: hard fail. Coupling thresholds (edge count, pair saturation, fan-out): warnings |

Adoption mechanics, the spec contract, and cross-tag rule selection: [../../overview.md](../../overview.md).
