# graph/feature-deps

| Field | Value |
|---|---|
| **Tag** | graph |
| **Mechanism** | Structural script (cross-file, pre-commit + CI) |
| **Blocking** | Mixed (cycles block, coupling thresholds warn) |

## What it prevents

Two classes of problems in the cross-feature dependency graph:

**Cycles (blocking).** Feature A imports from feature B and feature B imports from feature A. This creates a mutual dependency that defeats the purpose of feature boundaries — neither feature can evolve independently, and internal changes in one can break the other. Feature cycles indicate that shared logic should be extracted to `domains/` (for business logic) or `shared/` (for utilities and UI).

**Excessive coupling (non-blocking warning).** Even without cycles, a feature graph can become overly interconnected. Three coupling metrics signal that cross-feature dependencies are becoming structural rather than incidental:

- **Total edge count** — The number of unique feature-to-feature dependency edges across the entire project. When this exceeds the threshold, the feature graph is becoming a web rather than a tree.
- **Pair saturation** — The number of files within feature A that import from feature B. When many files in one feature import the same dependency, the relationship is pervasive and likely indicates shared logic that should be extracted.
- **Fan-out** — The number of distinct features that a single feature imports from. High fan-out means the feature has broad coupling and will be affected by changes in many other features.

## Where it applies

`src/features/*/` — all production `.ts` and `.tsx` files within feature directories, excluding tests, scripts, and generated files.

Only relevant when the project has two or more feature modules. Projects with a single feature skip this check.

## Algorithm

### Graph construction

1. **Enumerate features** — List subdirectories of `src/features/`. Each directory is a node.
2. **Collect production files** — For each feature, find `.ts`/`.tsx` files excluding `*.test.*`, `*.integration.test.*`, `__tests__/`, and `scripts/`.
3. **Extract cross-feature imports** — Scan each file for imports targeting other features:
   - Static: `from "@/features/<other-feature>"` or `from "@/features/<other-feature>/..."`
   - Dynamic: `import("@/features/<other-feature>...")`
   - Deduplicate targets per file (a file importing the same feature twice still creates one edge).
4. **Build directed graph** — Each feature is a node. An edge A -> B is annotated with the list of files in feature A that import feature B.

### Cycle detection (blocking)

5. **Find strongly connected components** — Use Tarjan's algorithm to identify SCCs of size > 1. Each SCC is a cycle.
6. **Report cycles** — For each SCC, emit the participating features, the specific edges forming the cycle, and exit with code 1.

### Coupling thresholds (non-blocking warnings)

7. **Total edge count** — Count unique edges. Warn if count exceeds the threshold.
8. **Pair saturation** — For each edge, check if the file count exceeds the threshold. Warn per-edge.
9. **Fan-out** — For each feature, count distinct import targets (out-degree). Warn if out-degree exceeds the threshold.

### Why Tarjan's for features

Feature graphs tend to be larger than domain graphs (10-30 features vs. 2-10 domains) and may contain multiple independent cycles. Tarjan's algorithm finds all SCCs in a single O(V+E) pass, making it more suitable than repeated DFS cycle detection.

## Configuration

```typescript
// Directory containing feature modules
const FEATURES_DIR = "src/features";

// Import patterns to detect cross-feature references
const STATIC_IMPORT = /from\s+["']@\/features\/([^/"']+)/g;
const DYNAMIC_IMPORT = /import\s*\(\s*["']@\/features\/([^/"']+)/g;

// Coupling thresholds (non-blocking)
const TOTAL_EDGE_THRESHOLD = 4;
const PAIR_SATURATION_THRESHOLD = 3;
const FAN_OUT_THRESHOLD = 2;
```

**Adjustments:**
- **Thresholds are starting points.** Calibrate to the project's actual coupling level. A project with 15 features will naturally have more edges than one with 3. The thresholds should signal "this is getting complex, consider extraction" rather than fire on every project.
- If the project uses a different path alias (e.g., `~/` instead of `@/`), update the import patterns.
- Add a `--baseline` flag to print the current dependency snapshot without enforcing thresholds. This is useful when onboarding the check to an existing project — capture the current state, then set thresholds just above it.

## Implementation

Bun TypeScript script, delegated from the structural check orchestrator. TypeScript is preferred over bash for this check because graph algorithms (Tarjan's) are more readable and maintainable in a real programming language.

Key implementation details:
- **Edge tracking** stores the list of importing files per edge, not just the edge existence. This is needed for pair saturation reporting and for actionable error messages that tell the agent exactly which files create the dependency.
- **Tarjan's algorithm** uses the standard index/lowlink/stack approach. Each SCC of size > 1 is a cycle.
- **Exit code logic**: exit 1 if any cycles found (even if thresholds also warn). Exit 0 if only threshold warnings. Exit 0 with no output if everything passes.
- **Relative path display** in output — convert absolute paths to project-relative for readable error messages.
- **`--baseline` mode** prints the full dependency snapshot (all edges, file lists, out-degrees) and exits. No enforcement. Used to capture the current state before calibrating thresholds.
- **File exclusion** must match the global test exclusion patterns: `*.test.*`, `*.integration.test.*`, `__tests__/`, `scripts/`.

## Example output

Cycle detection (blocking):

```
FAIL [feature-deps] src/features/chat
  Feature dependency cycle: chat <-> billing. Neither feature can evolve
  independently while this cycle exists.
  Extract shared logic to domains/* (business logic) or shared/* (utilities/UI).
```

Total edge count warning:

```
WARN [feature-deps] src/features/
  Total cross-feature edges (7) exceeds threshold (4). The feature graph
  is becoming a web rather than a tree.
  Extract shared logic to domains/* or shared/* to reduce coupling.
  Threshold is configured in the feature-deps check script.
```

Pair saturation warning:

```
WARN [feature-deps] src/features/chat
  Pair saturation: chat -> auth is imported from 5 files (threshold: 3).
  This dependency is pervasive, not incidental.
  Extract the shared concern to domains/* or shared/*.
  Threshold is configured in the feature-deps check script.
```

Fan-out warning:

```
WARN [feature-deps] src/features/admin
  Fan-out: feature "admin" imports from 4 other features (threshold: 2).
  Targets: auth, billing, chat, inventory.
  Consider whether shared logic should be extracted to domains/* or shared/*.
  Threshold is configured in the feature-deps check script.
```

## Why mixed blocking

**Cycles are blocking** because they represent a hard structural violation. Two features that depend on each other cannot be independently developed, tested, or refactored. The fix is always the same: extract the shared concern to `domains/` or `shared/`. There are no valid false positives for feature cycles.

**Coupling thresholds are non-blocking** because the right threshold depends on the project's size and domain complexity. A project with 20 features will legitimately have more cross-feature edges than one with 3. The thresholds are signals, not invariants — they tell the agent "this is worth examining" without blocking progress on work that may be intentionally adding a dependency. If the project has calibrated thresholds tightly and trusts them, they can be promoted to blocking.
