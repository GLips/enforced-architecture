# boundary/layer-occupancy

| Field | Value |
|---|---|
| **Tag** | boundary |
| **Mechanism** | Structural check (resolved import graph + directory presence, pre-commit + CI) |
| **Blocking** | Yes |

## What it prevents

A same-feature import reaching past a layer the feature **already has**.

A feature can carry a well-organised `service/` while its UI calls the repo, or a well-organised `controllers/` while its UI calls the service. The layers exist on disk and hold nothing; the logic they were supposed to concentrate is spread across three directories, and no single file looks wrong.

One question, asked of every same-feature downward edge: **which layers does it jump, and are any of them occupied?**

    const skipped = layerOrder.slice(from + 1, to).filter((layer) => occupied.includes(layer));

The activation is the design, not an optimisation. This is the **filesystem-aware complement to the per-file `db-isolation` rule**: that rule says which layers may touch the DB *at all*, statically and for every feature alike. This one tightens conditionally as a feature graduates. Nothing has been bypassed while there is nothing to bypass, so the rule never demands three directories before a young feature can do its job.

### The schema arm

The DB schema is not a layer, so a schema import is not a skip that slice can see — and it is the same failure. Once a feature's **lowest** layer is occupied, query **construction** belongs there, and anything above it assembling its own query has reached past that layer to the tables themselves.

It is a second arm rather than a wider slice because the *advice* differs. A layer skip is fixed by routing through the next hop **down**; a schema import is fixed by moving the query all the way into the lowest layer. One message covering both would name the wrong destination for one of them.

### Why schema but not client?

The DB **client** import (`@/infrastructure/db/client`) stays legal even when the lowest layer is occupied, and this is the distinction the arm turns on.

A caller passes the `db` instance down so several repo calls can be wrapped in one transaction. The transaction boundary is genuinely the caller's — it is the unit of work the request defines — so the caller has to hold the connection to open it.

The client conveys **execution** capability; the schema conveys **query construction** capability. Only construction must be concentrated in the data layer. A check that collapses the two into "controllers must not import `infrastructure/db`" takes the transaction boundary with it, and the first thing a team does about a rule that blocks correct code is switch it off.

## Where it applies

Every file inside a feature that sits in a layer — `features/*/<layer>/**`, for the layers `source.layerOrder` names — and only for features whose intermediate layers are occupied. Nesting is included: a file in a subdirectory is still in its layer, and that is exactly where the interesting spelling of the bypass lives.

A file at a **feature root** has no layer and no rank, and is skipped at both ends. That it sits there at all is `placement/topology`'s finding; inventing a rank for it is where this check would manufacture findings.

Filesystem presence decides **whether** to ask; the resolved import graph — see [graph/import-graph.md](../graph/import-graph.md) — decides **what the edge is**. Presence is an *occupancy* test rather than a bare `existsSync`, because an empty leftover layer would otherwise revoke access to everything below it while offering nowhere to put the code — the fix the message names would be a directory holding nothing.

**Do not grep for `../repo/`.** The bypass survives being written one directory deeper (`../../repo/x`) or as a same-feature alias (`@/features/<self>/repo/x`), and both spellings are ordinary code that a pattern-matching version reports as clean. The nested form is not even adversarial by intent — it is what the same import looks like after somebody tidies a layer into subfolders, so a grep-based rule silently uncovers itself during a refactor. The same defect hits `placement/layer-direction`, which is why both consume one graph.

## Type imports count

With no exception and no branch. The **rule of thumb, applied per invariant**: a check protecting BEHAVIOUR or the bundle exempts type imports, because a type cannot make a verdict depend on env; a check protecting KNOWLEDGE exempts nothing. This is the second kind.

If `ui/` names a type owned by `service/`, the service's shape is part of the UI's contract — change the return type and the UI breaks, and neither layer can be lifted out, which is the stated reason the layers exist. That the import compiles away is true and beside the point.

Counting only runtime edges would weaken "never bypass an occupied layer" into "never **execute through** a bypass", and make `import type` the supported way to bind UI straight to a repo contract with the controller layer sitting right there.

The **verdict** does not branch on `typeOnly`; the **wording** does. A reader told to route a type through the controller needs to know the check knows it is a type, or the finding reads as a false positive — and equally, a reader who wrote a runtime import must not be handed the type-import argument, because a blocking message that argues a case the reader is not in is one they learn to skim. `boundary/import-policy` reads the same marking the opposite way on purpose, and the difference is the subject: that rule is about a runtime dependency, this one is about knowledge.

## Negative space

**It does not detect upward edges, and `placement/layer-direction` detects no downward skip at all.** These two get conflated constantly. `layer-direction` rejects *upward* imports — a repo module importing a controller, a service importing UI. A UI module importing repo runs the right way through the layers; it is a skip, not a reversal, and `layer-direction` is silent on it by construction. A check answering both is a check nobody can predict.

**Skipping an ABSENT layer is correct.** A feature with no service is a feature that did not need one. What makes an edge a bypass is not its length but whether the layers it jumps over are occupied — which is why presence is tested rather than assumed, and why this cannot be a static policy: it depends on which directories exist today.

**Cross-feature access is not this rule's finding.** A file importing *another* feature's internals is a feature-boundary question that `graph/feature-deps` and `api/feature-visibility` already own. Two rules reporting one edge teaches people that one of them is noise. Layers also only rank against each other within one feature: `repo` in alpha and `service` in beta are not two rungs of one ladder.

**A feature's own BARREL is a hole this check cannot close alone.** A feature-root file has no layer, so `ui/ -> @/features/<self> -> service/` is invisible at both ends. `api/barrel-purity` is the other half; a barrel that re-exports a lower layer's types is how the bypass gets respelled with this check green.

**The DB client is legal, permanently.** See above. It is not an exception pending a better rule.

**An edge the graph could not place in the text is reported against the file with no line.** A wrong line on a blocking check sends someone to the wrong place; the file alone sends them to the right one.

**Coverage is exactly the graph's coverage.** The spellings `graph/import-graph.md` lists as unrevealed are edges this rule never receives.

## Adapt

- **`source.layerOrder`** is the layer policy, and this check names no layer at all. The endpoints' positions decide direction and what lies between them; the **last** entry is the data layer the schema arm gates on. A project that adds a fifth layer or renames `service/` to `usecases/` edits `policy/layout.ts`'s `FEATURE_LAYERS` and this follows — there is no second copy to keep in step, which is the failure the previous version's `repoLayer` / `serviceLayer` / `controllerLayer` keys made available: a name here that was not in `layerOrder` matched nothing and the check went quiet without erroring.
- **`checks["boundary/layer-occupancy"].schemaTarget`** — the resolved path of the DB schema modules from the source root, default `infrastructure/db/schema` (from `policy/layout.ts`'s `DB_SCHEMA_PATH`, which `boundary/db-isolation` also reads). A project whose schema lives at `@/db/schema` moves it there. Matched on whole path segments, so anything under it counts and `infrastructure/db/schema-utils.ts` does not. This is the check's only knob, because it is the only thing in it that is not a layer.
- **`source.featuresDirName`** decides where features are enumerated from. A project that calls them `modules/` renames in one place and this follows.
- The **alias prefix** is deliberately not a knob here. Resolution is the graph's business, which is what makes the aliased and relative spellings one edge in the first place.

At adoption the check is loudest on the features furthest along, since only a feature that grew layers can bypass them. Fix those edges rather than filtering them — there is no exclusion list, because a feature excluded from this rule is one whose layers exist and enforce nothing, which is the exact state the rule was written to make visible.

## Implementation

[`layer-occupancy.ts`](./layer-occupancy.ts). Feature layer presence comes from `CheckContext.occupiedDirs`; everything about the imports comes from the shared graph, via `edge.target` and `edge.to.layer` rather than `edge.specifier`.

## Fixtures

[`expectations/boundary/layer-occupancy.ts`](../../../../../../harness/structural-fixtures/expectations/boundary/layer-occupancy.ts).

The obvious case is `ui -> service` over an occupied `controllers/`, which has no controller in it at all — the shape a check gated on the source layer cannot see. The adversarial three are the ones a specifier matcher loses: `../../repo/x` from a nested directory, the same-feature alias, and the `import type` spelling.

The legal neighbours carry as much weight. `alpha/ui/within-feature-neighbour.ts` is `ui -> service` byte for byte, in a feature with **no** `controllers/` — the absence witness, and the case that fails the moment occupancy is weakened to "any intermediate layer". `thin/controllers/reports.ts` is the schema import that fires from billing, in a feature with no data layer to reach past. `billing/repo/invoice-rows.ts` is the schema import from *inside* the data layer, where the query belongs.

Four `messages` entries pin what no path comparison can see: that the type-aware paragraph is present on the type-only case, **absent** on the runtime one next to it, that the skipped layer is named from the slice rather than from a config key, and that the schema arm still makes the construction-vs-execution argument.

Every guard is revert-probed: restore the controllers-only gate, drop either occupancy filter, skip type imports again, delete the type-aware wording, make it unconditional, or delete the schema arm — each turns a different case red.

## Example output

```
FAIL [boundary/layer-occupancy] src/features/layers/ui/downward-neighbour.ts:15
  "../service/queries.ts" bypasses controllers/: ui imports
  from service directly, and feature "layers" has controllers/ occupied.
  Route the call through features/layers/controllers/ instead.
  Reaching past a present layer splits its job in two — some calls through it, some
  around it — and neither half looks wrong in the file it is written in.

FAIL [boundary/layer-occupancy] src/features/billing/controllers/typed-repo-neighbour.ts:14
  "@/features/billing/repo/invoice-rows.ts" bypasses service/: controllers imports
  from repo directly, and feature "billing" has service/ occupied.
  Route the call through features/billing/service/ instead.
  Reaching past a present layer splits its job in two — some calls through it, some
  around it — and neither half looks wrong in the file it is written in.
  This import is type-only, which is the same bypass: naming a repo type
  here makes that shape part of what controllers is written against, and neither
  can be lifted out while that is true.

FAIL [boundary/layer-occupancy] src/features/billing/controllers/invoices.ts:8
  controllers/ imports DB schema ("@/infrastructure/db/schema/invoices.ts"),
  but feature "billing" has a repo/ layer. Move the query into a
  function under features/billing/repo/ and call that instead.
  The DB client stays legal here — a caller passes it to repo functions for
  transaction handling. It is query CONSTRUCTION that has to be concentrated in repo/.
```

The first names the relative spelling back to you because that is what the file says, while the finding was made against the resolved path — which is the only reason it was made at all.
