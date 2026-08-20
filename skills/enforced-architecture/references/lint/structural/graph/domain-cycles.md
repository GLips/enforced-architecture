# graph/domain-cycles

| Field | Value |
|---|---|
| **Tag** | graph |
| **Mechanism** | Structural check (resolved import graph, pre-commit + CI) |
| **Blocking** | Yes |

## What it prevents

A cycle between domain modules — direct or transitive.

Domains are pure business logic at the bottom of the dependency graph. Everything above them may depend on them; they depend on nothing above. That is the entire claim a `domains/` directory makes, and a cycle inside it is that claim failing: if `billing` needs `usage` and `usage` needs `billing`, the two are not independent. They are one domain pretending to be two, and the directory boundary between them is decoration.

It goes load-bearing faster than almost anything else in this catalog. Feature code builds on both ends, tests exercise the circular path, and by the time anyone notices, breaking the cycle means restructuring both domains at once rather than moving one function. The cost of catching it late is what justifies blocking rather than warning.

## Why this is a script and not a lint rule

**The violation is invisible at the file level.** Each file in a cycle is unremarkable on its own. A per-file rule can confirm that `@/domains/usage` is spelled correctly from inside `domains/billing`, and it is right to — the import is legal, taken by itself. What it cannot know is that `usage` imports back. Nothing in either file says so.

The transitive form is worse, and it is the common one. In `alerts -> quota -> thresholds -> alerts`, no two domains import each other, and the middle hop looks exactly like a domain depending on a lower one, which is what a domain is allowed to do. There is no file to point at and no pair to compare. Only a pass over the whole component finds it, which is why this consumes the resolved edge list from [graph/import-graph.md](import-graph.md) rather than matching anything.

## Where it applies

Every edge in the import graph whose two ends sit in *different* `domains/<name>` boundaries. A relative hop inside one domain is how a module moves within itself and is not an edge in this graph at all.

**Fewer than two occupied domains means there is no subject.** A project with no `domains/` directory, or with one domain, is skipped — and occupancy is tested rather than directory presence, because an empty leftover directory otherwise manufactures a domain and the check reports a passing result over a set it never really had. One domain cannot form a cycle with itself here, since a within-domain import never leaves its boundary.

## Negative space

**It is self-contained about spelling, deliberately.** Both the aliased and the relative form of a crossing are the same edge here, because the check reads the *resolved* ends and never the specifier. It does not assume `boundary/cross-boundary-alias` has already run and banned the relative one. Two checks are two chances for one to be off, disabled, or adopted later than the other, and a cycle check that only saw aliased imports would report clean on a codebase whose cycles were written relatively — silently, since a missing edge produces no finding.

**It says nothing about whether an edge should exist.** `pricing -> catalog` is a normal domain graph and is never reported. The rule is against cycles, not against edges; a check that reports layered domains is one that forbids layering domains, and it gets switched off.

**Type-only edges count.** The graph marks them and this check ignores the marking: a circular type dependency is still two domains that cannot be understood or extracted apart, which is the coupling this is about. Reasoning about runtime dependency alone is a different question than this one.

**One finding per cycle, not per edge.** A component holding several intertwined cycles is one finding, because the domains in it are untangled together and reporting each ring separately implies they can be fixed separately.

**Coverage is exactly the graph's coverage.** The spellings `graph/import-graph.md` lists as unrevealed are edges this check never receives. Widening a matcher here rather than the extractor there is how two checks end up governing different sets of imports while claiming the same scope.

## Adapt

`source.domainsDirName` is the only knob, and it is shared: a project that calls its domains `core/` or `modules/` renames it once there and every graph consumer follows. The alias prefix and the boundary model belong to the graph, and nothing here needs to know them.

**There are no thresholds.** Any cycle is a hard failure. There is no count at which a cycle becomes acceptable and no exclusion list, which is deliberate — a suppressed cycle is a suppressed claim about the whole `domains/` layer, and nothing at the suppression site would say so.

The only real adjustment is at adoption: an existing codebase may already have one. Fix it before turning the check on rather than filtering it.

## Example output

A direct cycle:

```
FAIL [graph/domain-cycles] src/domains/billing
  Circular dependency between 2 domains: billing, usage.
    billing -> usage: src/domains/billing/index.ts (line 12) imports "@/domains/usage/errors.ts"
    usage -> billing: src/domains/usage/index.ts (line 6) imports "@/domains/billing/errors.ts"
  Domains are pure business logic at the bottom of the dependency graph, so a
  cycle means these are not independent — they are one domain pretending to be
  2. Extract what they share into a separate domain they can all depend on,
  or merge them if they are a single concern. …
```

And the transitive one, which is the same finding shape at depth three:

```
FAIL [graph/domain-cycles] src/domains/alerts
  Circular dependency between 3 domains: alerts, quota, thresholds.
    alerts -> quota: src/domains/alerts/index.ts (line 13) imports "@/domains/quota/index.ts"
    quota -> thresholds: src/domains/quota/index.ts (line 7) imports "@/domains/thresholds/index.ts"
    thresholds -> alerts: src/domains/thresholds/index.ts (line 6) imports "@/domains/alerts/errors.ts"
  …
```

Each is filed against the alphabetically first participating domain's **directory**. A cycle is a property of the component rather than of any one file, so blaming whichever file happens to close it makes the finding move when an unrelated import is added — and a blocking check that re-baselines on its own is one people learn to re-baseline without reading. Every edge in the component is listed in the body, which is where the file and line to open actually are.

## Implementation

[domain-cycles.ts](domain-cycles.ts). Tarjan's strongly connected components over the domain graph; every component with more than one member is a cycle. The comment there says why an SCC pass rather than a colour walk, given that either is fast enough at this size.

## Fixtures

The one that decides it is the transitive ring `alerts -> quota -> thresholds -> alerts`. No pair in it is mutual, so the natural implementation — does A import B and does B import A — reports nothing there while passing the direct `billing <-> usage` pair beside it.

The legal neighbours carry the other half. `pricing -> catalog` with nothing coming back is what an undirected reading of the edge set reports as a cycle; a domain importing `shared/` and relatively into itself is what a check counting every outgoing import as a domain edge turns into a self-loop.
