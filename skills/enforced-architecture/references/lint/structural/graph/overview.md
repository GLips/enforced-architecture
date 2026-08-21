# graph — Cross-file dependency analysis

Structural-only: every question here is about edges between files, so there is nothing a per-file
rule could answer. `import-graph` is not a rule — it is the substrate the others read, and the
first thing to stand up.

| Rule | Blocking | What it buys |
|---|---|---|
| [import-graph](../import-graph.ts) | — | Not a rule: the resolved import graph every graph-reading rule consumes instead of matching import strings. Build it first |
| [domain-cycles](domain-cycles.ts) | Yes | No domain depends on a domain that depends on it back, at any depth |
| [feature-deps](feature-deps.ts) | Mixed | No feature imports a feature that imports it back, at any depth |

Both rules see only the edges that `import-graph` resolves. An import spelling that the graph does
not reveal is a cycle these rules do not report.

`domain-cycles` has no threshold and no exclusion list. Any cycle is a hard failure, thus a codebase
that has a domain cycle today must remove it before you switch the check on.

In `feature-deps`, only the cycle findings fail. The three coupling thresholds — total edges, pair
saturation, fan-out — give warnings. A project that sets each one from its current counts can then
make them fail the run, in its own orchestrator.

`feature-deps` needs two or more occupied feature directories to have a subject. A project with one
feature must not register it. A check with no subject looks like coverage, and there is none.

`feature-deps` asks what shape the whole edge set forms; `api/feature-visibility` asks whether one
edge is intended. One does not cover the other: a cycle of granted edges still fails `feature-deps`.

Adoption mechanics, the spec contract, and what part of the tree owns each rule's subject: [../../overview.md](../../overview.md).
