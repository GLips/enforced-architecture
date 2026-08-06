# graph/domain-cycles

| Field | Value |
|---|---|
| **Tag** | graph |
| **Mechanism** | Structural script (cross-file, pre-commit + CI) |
| **Blocking** | Yes |

## What it prevents

Circular dependencies between domain modules. Domain A imports domain B, and domain B imports domain A (directly or transitively). This is a hard structural violation because domains are pure business logic at the bottom of the application dependency graph. If two domains form a cycle, they are not independent — they are one domain pretending to be two.

Cycles between domains are especially dangerous because they tend to be invisible at the file level. A per-file lint rule can verify that a domain import uses the correct barrel path, but it cannot detect that the target domain imports back. Only cross-file graph analysis catches this.

Once a domain cycle exists, it becomes load-bearing quickly. Feature code builds on both domains, tests exercise the circular path, and untangling requires restructuring both domains simultaneously. The cost of catching this late is high enough to justify blocking enforcement.

## Where it applies

`src/domains/*/` — all production `.ts` and `.tsx` files within domain directories, excluding tests, scripts, and generated files.

Only relevant when the project has two or more domain modules. Projects without a `domains/` directory or with a single domain skip this check.

## Algorithm

1. **Enumerate domains** — List subdirectories of `src/domains/`. Each directory is a node in the graph.
2. **Collect production files** via the shared library's walker, which applies the global exclusions once. Do not restate them here.
3. **Extract cross-domain imports** — Filter the resolved graph, do not scan for patterns: keep edges whose two ends sit in different `domains/<name>` boundaries. See [graph/import-graph.md](import-graph.md). Resolution is what makes the aliased and relative spellings one edge, and this check must not assume `boundary/cross-boundary-alias` already ran.
4. **Build directed graph** — Each domain is a node. An edge A -> B exists if any production file in domain A imports from domain B.
5. **Detect cycles** — DFS with three-color marking, or Tarjan's SCCs of size > 1. Domain graphs run under 20 nodes; take whichever reads clearer.
6. **Report** — Return one error finding per cycle, naming the participating domains. The orchestrator owns the exit code.

## Configuration

```typescript
// Directory containing domain modules
const DOMAINS_DIR = "src/domains";

```

**Adjustments:**
- The alias prefix is configured once, in the graph. Nothing here needs to know it.
- No thresholds to configure. Any cycle is a hard failure.

## Implementation

Bun TypeScript check function behind the structural orchestrator.

Key implementation details:
- **Both aliased and relative imports** must be checked. The cross-boundary-alias rule prevents relative cross-boundary imports, but the cycle check should be self-contained and not depend on other rules having caught all relative imports first.
- **Return findings.** The orchestrator owns reporting and the process exit code.
- **Early exit** if `domains/` does not exist or contains fewer than 2 domain directories.

## Example output

```
FAIL [domain-cycles] src/domains/billing
  Circular dependency: billing <-> usage. Domain "billing" imports from
  domain "usage" and domain "usage" imports from domain "billing".
  Extract the shared logic into a third domain that both can depend on,
  or merge the two domains if they represent a single concern.
```

For transitive cycles:

```
FAIL [domain-cycles] src/domains/billing
  Transitive cycle: billing -> usage -> billing (2 domains involved).
  Break the cycle by extracting shared types/logic into a domain that
  both can depend on without creating a back-edge.
```
