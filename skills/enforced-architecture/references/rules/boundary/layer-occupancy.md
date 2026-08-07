# boundary/layer-occupancy

| Field | Value |
|---|---|
| **Tag** | boundary |
| **Mechanism** | Structural script (resolved import graph + directory presence, pre-commit + CI) |
| **Blocking** | Yes |

## What it prevents

A controller reaching past a layer the feature **already has**.

A feature can carry a well-organised `service/` and `repo/` while its controllers quietly build their own queries and call repo functions directly. The layers exist on disk and hold nothing; the logic they were supposed to concentrate is spread across three directories, and no single file looks wrong. Two bypasses, and which of them is asked depends on what the feature has grown:

1. **Repo bypass** — once a feature has a `repo/` directory, its controllers may not import DB schema modules and assemble queries themselves. Query construction belongs in `repo/`.
2. **Service bypass** — once a feature has **both** `service/` and `repo/`, its controllers may not import from `repo/` directly. Reaching past a present `service/` splits orchestration in two: some calls through it, some around it.

The activation is the design, not an optimisation. This is the **filesystem-aware complement to the per-file `db-isolation` rule**: that rule says which layers may touch the DB *at all*, statically and for every feature alike. This one tightens conditionally as a feature graduates. A feature with a single controller and no layers beneath it reaches infrastructure directly and is correct to; adding `repo/` revokes the controller→schema shortcut; adding `service/` on top revokes the controller→repo shortcut. Nothing has been bypassed while there is nothing to bypass, so the rule never demands three directories before a young feature can read a table.

### Why schema but not client?

The DB **client** import (`@/infrastructure/db/client`) stays legal from a controller even when `repo/` exists, and this is the distinction the whole rule turns on.

Controllers pass the `db` instance to repo functions so several repo calls can be wrapped in one transaction. The transaction boundary is genuinely the controller's — it is the unit of work the request defines — so the controller has to hold the connection to open it.

The client conveys **execution** capability; the schema conveys **query construction** capability. Only construction must be concentrated in `repo/`. A check that collapses the two into "controllers must not import `infrastructure/db`" takes the transaction boundary with it, and the first thing a team does about a rule that blocks correct code is switch it off.

## Where it applies

Controller files inside a feature — `features/*/controllers/**` — but only for features whose `repo/` or `service/` directory is occupied. Nesting is included: a controller in a subdirectory is still a controller, and that is exactly where the interesting spelling of the bypass lives.

Filesystem presence decides **whether** to ask; the resolved import graph — see [graph/import-graph.md](../graph/import-graph.md) — decides **what the edge is**. Presence is an *occupancy* test rather than a bare `existsSync`, because an empty leftover `repo/` would otherwise revoke the controller's schema access while offering nowhere to put the query.

**Do not grep for `../repo/`.** The bypass survives being written one directory deeper (`../../repo/x` from a nested controller) or as a same-feature alias (`@/features/<self>/repo/x`), and both spellings are ordinary code that a pattern-matching version reports as clean. The nested form is not even adversarial by intent — it is what the same import looks like after somebody tidies `controllers/` into subfolders, so a grep-based rule silently uncovers itself during a refactor. The same defect hits `structure/layer-direction`, which is why both consume one graph.

## Negative space

**It does not detect downward layer skips anywhere but here, and `structure/layer-direction` detects none at all.** These two get conflated constantly. `layer-direction` rejects *upward* imports — a repo module importing a controller, a service importing UI. A controller importing repo runs the right way through the layers; it is a skip, not a reversal, and `layer-direction` is silent on it by construction. This rule covers exactly the two controller edges above and no other skip.

**Cross-feature repo access is not this rule's finding.** A controller importing *another* feature's `repo/` is a feature-boundary question that `graph/feature-deps` and `api/feature-visibility` already own. Two rules reporting one edge teaches people that one of them is noise.

**Type-only edges are excluded.** `import type { … } from "@/features/<self>/repo/x"` compiles away and creates no runtime dependency, so routing it through a layer buys nothing. The graph marks these; the marking is dropped deliberately here, not lost. `boundary/cross-boundary-alias` ignores the same marking on purpose, and the difference is the subject: that rule is about a string no other rule can see, this one is about a runtime dependency.

**The DB client is legal, permanently.** See above. It is not an exception pending a better rule.

**An edge the graph could not place in the text is reported against the file with no line.** A wrong line on a blocking check sends someone to the wrong place; the file alone sends them to the right one.

**Coverage is exactly the graph's coverage.** The spellings `graph/import-graph.md` lists as unrevealed are edges this rule never receives.

## Adapt

Every knob is `checks["boundary/layer-occupancy"]` in the architecture config — nothing is a constant in the check body.

- **`schemaTarget`** — the resolved path of the DB schema modules from the source root, default `infrastructure/db/schema`. A project whose schema lives at `@/db/schema` sets `"db/schema"`. Matched on whole path segments, so anything under it counts and `infrastructure/db/schema-utils.ts` does not.
- **`repoLayer`, `serviceLayer`, `controllerLayer`** — the layer directory names, so a project using `data/` and `usecases/` renames here. Keep them in step with `source.layerOrder`, which is what the graph classifies against; a name here that is not in `layerOrder` matches nothing and the check goes quiet without erroring.
- **`source.featuresDirName`** decides where features are enumerated from. A project that calls them `modules/` renames in one place and this follows.
- The **alias prefix** is deliberately not a knob here. Resolution is the graph's business, which is what makes the aliased and relative spellings one edge in the first place.

At adoption the check is loudest on the features furthest along, since only a feature that grew layers can bypass them. Fix those edges rather than filtering them — there is no exclusion list, because a feature excluded from this rule is one whose layers exist and enforce nothing, which is the exact state the rule was written to make visible.

## Implementation

[`layer-occupancy.ts`](./layer-occupancy.ts). Feature enumeration and layer presence come from `CheckContext.occupiedDirs`; everything about the imports comes from the shared graph, via `edge.target` and `edge.to.layer` rather than `edge.specifier`.

## Fixtures

[`expectations/boundary/layer-occupancy.ts`](../../../../../harness/script-fixtures/expectations/boundary/layer-occupancy.ts).

The two a grep-based version passes: `../../repo/x` from a nested controller, and the same import written as a same-feature alias. The legal neighbours carry as much weight — a controller importing the DB *client* while `repo/` exists, a type-only import of the very repo module the adversarial cases fire on, and a feature with neither layer whose controller imports the schema directly. That last one is the presence test's only witness: drop the test and it starts reporting.

## Example output

```
FAIL [boundary/layer-occupancy] src/features/billing/controllers/invoices.ts:8
  Controller imports DB schema ("@/infrastructure/db/schema/invoices.ts"),
  but feature "billing" has a repo/ layer. Move the query into a
  function under features/billing/repo/ and call that instead.
  The DB client stays legal here — controllers pass it to repo functions for
  transaction handling. It is query CONSTRUCTION that has to be concentrated in repo/.

FAIL [boundary/layer-occupancy] src/features/billing/controllers/nested/jobs.ts:12
  Controller imports repo/ directly ("../../repo/invoice-rows.ts"),
  but feature "billing" has a service/ layer. Route the call through
  features/billing/service/ instead.
  Reaching past a present service/ splits orchestration in two — some calls
  through it, some around it — and neither half looks wrong in the file it is written in.
```

The second names the relative spelling back to you because that is what the file says, while the finding was made against the resolved path — which is the only reason it was made at all.
