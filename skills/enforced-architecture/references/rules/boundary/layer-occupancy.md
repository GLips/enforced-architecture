# boundary/layer-occupancy

| Field | Value |
|---|---|
| **Tag** | boundary |
| **Mechanism** | Structural script (cross-file, pre-commit + CI) |
| **Blocking** | Yes |

## What it prevents

Controllers bypassing present layers. The invariant is "skip absent layers, never bypass present ones." This check enforces the "never bypass" half for two layer boundaries:

1. **Repo bypass** — When a feature has a `repo/` directory, controllers cannot import DB schema modules to build queries themselves. All DB query construction must flow through the repo layer. Controllers may still import the DB client (`infrastructure/db/client`) to pass it to repo functions for transaction handling, but schema imports (query construction) must go through repo/.

2. **Service bypass** — When a feature has both `service/` and `repo/` directories, controllers cannot import from repo/ directly. All repo access must flow through the service layer. This prevents controllers from fragmenting orchestration logic by calling some repo functions through service and others directly.

This is the filesystem-aware complement to the per-file DB isolation rule. The per-file rule (db-isolation) restricts which layers can import DB at all. This structural check adds conditional tightening as features graduate: adding repo/ revokes the controller-to-schema shortcut, and adding service/ revokes the controller-to-repo shortcut.

Without this check, a feature could have well-organized service/ and repo/ directories while individual controllers silently bypass them, fragmenting logic across layers.

## Where it applies

`src/features/*/controllers/**/*.ts` — but only for features that have a `src/features/*/repo/` or `src/features/*/service/` directory. Features without either are not checked (their controllers access infrastructure directly).

## Algorithm

Consumes the resolved import graph — see [graph/import-graph.md](../graph/import-graph.md). Filesystem presence decides *whether* to check; the graph decides *what* the edge is.

1. **Enumerate features** and test which layer directories exist. If neither `repo/` nor `service/` is present, skip the feature.
2. **Take the feature's edges from the graph**, already classified by source and target layer.
3. **Flag bypassed present layers** — a controller→schema edge when `repo/` exists; a controller→repo edge when `service/` also exists.
4. **Exclude type-only imports.** They create no runtime dependency.
5. **Report** the feature name, file path, and a fix instruction.

**Do not grep for `../repo/`.** The bypass survives being written one directory deeper (`../../repo/x` from a nested controller) or as an alias (`@/features/<self>/repo/x`), and both spellings are ordinary code that a pattern-matching version reports as clean. The same defect hits `structure/layer-direction`, which is why both consume one graph.

Extend the check to the whole direction, not just the controller edge. UI calling service or repo directly bypasses present layers in exactly the same way, and a check covering one edge of the order reads as covering the order.

### Why schema but not client?

The DB client import (`@/infrastructure/db/client`) is allowed from controllers even when repo/ exists. Controllers pass the `db` instance to repo functions to enable transaction handling (wrapping multiple repo calls in a single transaction). The client import conveys execution capability; the schema import conveys query construction capability. Only query construction must be concentrated in repo/.

## Configuration

Both questions are asked of the resolved graph, not of the source text. What is configured here is *which targets count*, expressed as resolved paths from the source root:

```typescript
// Direct DB query construction (controllers → schema when repo/ exists)
const SCHEMA_TARGET = "infrastructure/db/schema";

// Direct repo access (controllers → repo when service/ exists). Compared as a
// resolved path, so `../repo/x` and `@/features/alpha/repo/x` are one edge —
// which is the whole reason this consumes the graph. A pattern on `../repo/`
// sees the first and not the second.
const REPO_LAYER = "repo";

// Type-only edges carry no runtime coupling, so both checks skip them. The graph
// marks them; see the type-only discussion in graph/import-graph.md, including
// which spellings it does not catch.
```

**Adjustments:**
- If your DB schema lives elsewhere (e.g., `@/db/schema`), update `SCHEMA_TARGET` to its resolved path.
- If your project uses different layer names (e.g., `data/` instead of `repo/`, `usecases/` instead of `service/`), update the directory checks and `LAYER_ORDER` in the graph. The alias prefix is the graph's business, not this rule's.

## Implementation

A function behind the structural check orchestrator, returning findings tied to their files. Feature enumeration uses directory listing rather than glob, so it does not expand into subdirectories; layer presence is a directory test. Everything about the imports themselves comes from the shared graph.

## Fixtures

The two that a grep-based version passes: an upward import written `../../repo/x` from a nested controller, and one written as a same-feature alias. Plus the legal neighbour — a controller importing the DB *client* while `repo/` exists, which is allowed.

## Example output

```
FAIL [layer-occupancy] src/features/billing/controllers/invoices.ts
  Controller imports DB schema directly, but feature "billing" has a repo/ layer.
  Move the query to a function in src/features/billing/repo/ and import that
  instead. Controllers may import the DB client for transaction handling, but
  schema imports (query construction) must flow through repo/.

FAIL [layer-occupancy] src/features/agent/controllers/jobs.ts
  Controller imports repo directly, but feature "agent" has a service/ layer.
  Route the call through src/features/agent/service/ instead.
  When service/ exists, controllers must not bypass it to reach repo/.
```
