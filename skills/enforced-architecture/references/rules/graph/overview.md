# graph — Cross-file dependency analysis

| Rule | Mechanism | Blocking | What it prevents |
|---|---|---|---|
| [import-graph](import-graph.md) | Substrate | — | Not a rule: the resolved import graph every graph-reading rule consumes instead of matching import strings. Build it first |
| [domain-cycles](domain-cycles.md) | Script | Yes | Circular dependencies between domains |
| [feature-deps](feature-deps.md) | Script | Mixed | Cycles: hard fail. Coupling thresholds (edge count, pair saturation, fan-out): warnings |

Adoption mechanics, the spec contract, and cross-tag rule selection: [../overview.md](../overview.md).
