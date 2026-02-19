# graph/domain-cycles

| Field | Value |
|---|---|
| **Tag** | graph |
| **Mechanism** | Structural script (cross-file, pre-commit + CI) |
| **Blocking** | Yes |

## What it prevents

Circular dependencies between domain modules. Domain A imports domain B, and domain B imports domain A (directly or transitively). This is a hard structural violation because domains are pure business logic at the bottom of the application dependency graph. If two domains form a cycle, they are not independent — they are one domain pretending to be two.

Cycles between domains are especially dangerous because they tend to be invisible at the file level. GritQL per-file rules can verify that a domain import uses the correct barrel path, but they cannot detect that the target domain imports back. Only cross-file graph analysis catches this.

Once a domain cycle exists, it becomes load-bearing quickly. Feature code builds on both domains, tests exercise the circular path, and untangling requires restructuring both domains simultaneously. The cost of catching this late is high enough to justify blocking enforcement.

## Where it applies

`src/domains/*/` — all production `.ts` and `.tsx` files within domain directories, excluding tests, scripts, and generated files.

Only relevant when the project has two or more domain modules. Projects without a `domains/` directory or with a single domain skip this check.

## Algorithm

1. **Enumerate domains** — List subdirectories of `src/domains/`. Each directory is a node in the graph.
2. **Collect production files** — For each domain, find `.ts`/`.tsx` files excluding `*.test.*`, `*.integration.test.*`, `__tests__/`, and `scripts/`.
3. **Extract cross-domain imports** — Scan each file for import statements targeting other domains:
   - Aliased: `from "@/domains/<other-domain>"` or `from "@/domains/<other-domain>/..."`
   - Relative: `from "../<other-domain>"` or `from "../../<other-domain>"` (these are also caught by the cross-boundary-alias rule, but the cycle check should not assume the cross-boundary-alias rule has already been applied)
4. **Build directed graph** — Each domain is a node. An edge A -> B exists if any production file in domain A imports from domain B.
5. **Detect cycles** — Run DFS with three-color marking (white/gray/black). A back-edge (encountering a gray node) indicates a cycle. Alternatively, use Tarjan's algorithm to find strongly connected components of size > 1.
6. **Report** — For each cycle, emit the participating domains and exit with code 1.

### Why DFS over Tarjan's

Either algorithm works. DFS with three-color marking is simpler to implement and produces clear "A <-> B" cycle reports. Tarjan's is more efficient when the graph is large and you want all SCCs in one pass. For domain graphs (typically < 20 nodes), the choice is irrelevant. Use whichever the implementing agent finds clearer.

## Configuration

```typescript
// Directory containing domain modules
const DOMAINS_DIR = "src/domains";

// Import patterns to detect cross-domain references
const ALIASED_IMPORT = /from\s+["']@\/domains\/([^/"']+)/g;
const RELATIVE_IMPORT = /from\s+["']\.\.\/([^/"']+)/g;
```

**Adjustments:**
- If the project uses a different path alias (e.g., `~/` instead of `@/`), update the aliased import pattern.
- The relative import pattern catches `../<domain>` which is the most common relative cross-domain path. Add deeper patterns (`../../<domain>`) if the domain directory structure is nested.
- No thresholds to configure. Any cycle is a hard failure.

## Implementation

Bun TypeScript script, delegated from the structural check orchestrator. Can also be implemented as a shell function — but TypeScript is more maintainable for graph algorithms.

Key implementation details:
- **File exclusion** must match the global test exclusion patterns: `*.test.*`, `*.integration.test.*`, `__tests__/`, `scripts/`.
- **Both aliased and relative imports** must be checked. The cross-boundary-alias rule prevents relative cross-boundary imports, but the cycle check should be self-contained and not depend on other rules having caught all relative imports first.
- **Exit code 1** on any cycle. The orchestrator increments its error counter and propagates the failure.
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
