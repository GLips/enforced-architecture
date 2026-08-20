# graph/feature-deps

| Field | Value |
|---|---|
| **Tag** | graph |
| **Mechanism** | Structural script — [feature-deps.ts](feature-deps.ts) |
| **Blocking** | Mixed (cycles fail, coupling thresholds warn) |

## What it prevents

**Cycles (blocking).** Feature A imports from feature B and B imports back, directly or transitively. Neither feature can evolve independently, and internal changes in one can break the other. The fix is always the same: extract the shared concern to `domains/` (business logic) or `shared/` (utilities and UI).

**Excessive coupling (warning).** Even without cycles a feature graph can become a web rather than a tree. Three metrics say so from different angles, which is why all three are here rather than one:

- **Total edge count** — how interconnected the graph is overall.
- **Pair saturation** — how many files inside feature A import feature B. Many files reaching for the same dependency means the relationship is pervasive rather than incidental, and the shared concern probably wants extracting.
- **Fan-out** — how many distinct features one feature depends on. High fan-out means it will be affected by changes almost anywhere.

## Where it applies

Every production file under the features directory. It reads the resolved import graph rather than the source text, so the aliased and relative spellings of one edge are one edge — a pattern on `@/features/<name>` misses the relative spelling, and a cycle written relatively would be invisible to exactly the check meant to catch it.

Only relevant with two or more features. Below that the check returns nothing, because there is no subject: it does not report a clean result over a set it never had. A project with one feature should not register it at all — an unadopted check left in the registry reads as coverage that is not there.

Features are counted by **occupancy**: a directory holding at least one source file. An empty leftover directory otherwise manufactures a subject.

## It is not visibility

These get conflated, and the conflation costs real time. This check asks *what shape does the set of edges form*; [api/feature-visibility](../api/feature-visibility.md) asks *was this one edge intended*. The second is blind to the first, so **a cycle built from fully-granted, individually-legal edges is still a cycle and still hard-fails here.** No configuration buys it back, and declaring both directions only writes the cycle down.

That distinction is the reading rule when a check fails: *ungranted edge* means declare it or extract; *cycle* means restructure, and editing a visibility file is wasted motion. When neither feature can give up the shared code without cycling, the split is on the wrong axis — re-cut by use-case journey rather than by data ownership.

## Why mixed blocking

**Cycles block** because there are no valid false positives. Two features that depend on each other cannot be independently developed, tested, or refactored.

**Thresholds warn** because the right value depends on the project's size and domain complexity. A project with 20 features will legitimately carry more cross-feature edges than one with 3. They are signals, not invariants: they say "this is worth examining" without blocking work that may be deliberately adding a dependency. A project that has calibrated them tightly and trusts them can promote them to blocking in its own orchestrator.

## Adapt

Knobs live in `config.checks["graph/feature-deps"]`: `totalEdgeThreshold`, `pairSaturationThreshold`, `fanOutThreshold`. Which directory holds features is `config.source.featuresDirName`.

**The defaults are starting points, not recommendations.** Calibrate to the project's actual coupling: print the current edge set, then set each threshold just above it, so they signal growth rather than fire on day one. A check that fires on the state of the world the day it was installed is a check that gets switched off in the same week.

## Negative space

- **No `--baseline` flag.** The original design called for one — a mode that prints the dependency snapshot without enforcing, for calibrating thresholds on an existing project. It is not implemented here, because a check returns findings and the orchestrator owns modes; a project that wants it adds it to its own orchestrator, reading the same edge set.
- **Type-only edges count.** A type crossing a feature boundary still couples the two: the importee cannot reshape it without breaking the importer.
- **Cycles are reported per strongly connected component**, not per pair, using Tarjan's — so every independent cycle surfaces in one pass. A check that reports the first cycle it finds is a queue rather than an answer: the project fixes it and meets the next one on the following commit.

## Example output

```
FAIL [graph/feature-deps] src/features/billing
  Feature dependency cycle: billing <-> chat.
  Edges forming it: billing -> chat, chat -> billing.
  Neither feature can evolve independently while this cycle exists. Extract the
  shared concern to domains/ (business logic) or shared/ (utilities and UI).
  A visibility grant does not buy this back — declaring both directions only
  writes the cycle down.

WARN [graph/feature-deps] src/features/chat
  Pair saturation: chat -> auth is imported from 5 files (threshold: 3).
  This dependency is pervasive, not incidental. Extract the shared concern to
  domains/ or shared/.

WARN [graph/feature-deps] src/features/admin
  Fan-out: "admin" imports from 4 other features (threshold: 2).
  Targets: auth, billing, chat, inventory.
  Consider whether shared logic should be extracted to domains/ or shared/.
```
