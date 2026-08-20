# placement/layer-direction

| Field | Value |
|---|---|
| **Tag** | placement |
| **Mechanism** | Structural check (resolved import graph, pre-commit + CI) |
| **Blocking** | Yes |

## What it prevents

A lower layer importing from a higher one inside the same feature.

The layer stack is the only thing a feature says about which way dependency runs. `ui` calls down into `controllers`, `controllers` into `service`, `service` into `repo`, and each rung is replaceable because nothing beneath it knows the rung above exists. One upward edge ends that:

```ts
// src/features/billing/repo/invoices.ts
import { priceInvoice } from "../service/pricing";   // repo reaches up into service
```

`repo` and `service` are now one module spread across two directories. The repo cannot be tested, replaced, or read without the service, the service cannot be changed without checking what the repo took from it, and the stack that was supposed to describe the feature describes nothing. Nothing about the code looks wrong — it is one import, and the thing it wants is genuinely up there — which is why the edge accumulates and why this blocks rather than warns. Each accumulated instance is a layer boundary that has already stopped meaning anything.

The fix is almost always to move what both layers need *down*, to the lower one or out to a domain, or to invert the call so the higher layer drives the lower. Reaching upward is the one option that costs nothing today and everything later.

**Downward imports are the normal direction and are never reported.** A check that flags the correct case is one that gets switched off within a week, taking the upward edges with it.

### The feature's own barrel

One edge inside a feature climbs without having a rank to climb: a layer importing `@/features/<self>` or `../index.ts`.

```ts
// src/features/orders/ui/summary.tsx
import { placeOrder } from "../index.ts";            // reaches the feature's own barrel
```

The barrel sits in no layer, so the rank comparison below skips it — and it is the sharpest upward edge a feature can contain. The barrel re-exports the layers, so `ui` reaching it takes a dependency on all of them at once, including every layer above `ui`, and the cycle runs through the file whose job is to describe the feature from *outside*. The fix is to import the sibling module directly; the barrel is for consumers.

This arm is here rather than in `boundary/import-policy` because the policy engine returns `internal` for it: source and target are one unit, which is exactly right for a policy about crossings and exactly wrong for the question of direction inside a feature. It also fires on the **aliased** spelling, which is what auto-import writes and which the structural half of `import-policy` never sees.

## Why this is a script and not a lint rule

The specifier does not carry the answer. Whether an import climbs a layer depends on how deep the *importing* file sits, so the path has to be resolved against the tree and both ends classified:

```ts
// from src/features/alpha/repo/nested/deep.ts
import { x } from "../../service/x";                  // climbs a layer — the pattern expected one ../
// from src/features/alpha/repo/root.ts
import { x } from "@/features/alpha/controllers/x";   // climbs a layer, written as an alias
```

A per-file lint rule matching `^\.\./(service|controllers|ui)/` catches the first spelling of the first example and nothing else. The nested form is the same edge one directory deeper; the aliased form is the same edge again, written the way a project's own conventions encourage — which makes it the spelling an upward import is most likely to survive review in. A rule that catches one of three spellings certifies the other two.

The resolution is not this rule's work. It consumes the shared edge list from [graph/import-graph.md](../graph/import-graph.md), which is also what makes its verdict agree with `boundary/import-policy` and `boundary/layer-occupancy` rather than being one of three private opinions about where an import lands.

## Where it applies

Every edge in the import graph whose two ends sit in the **same feature** and carry a **layer** on both ends. Everything else is outside the rule by construction:

- **Cross-feature edges.** `repo` in one feature and `service` in another are not two rungs of one ladder. Whether that edge should exist at all is `graph/feature-deps` and `api/feature-visibility`; ranking the layers across it turns every cross-feature import into a direction verdict.
- **Edges with no layer on either end.** A file at a feature root is in no layer, and neither is anything outside `features/`. There is no direction to be wrong about. The one exception is the feature's own barrel, which is judged without a rank because it sits above every layer by construction.
- **Anything landing outside the source root** — a package, a path climbing past `src/` — never reaches the graph.

## Negative space

**It does not detect downward layer skips.** `controllers` importing straight past `service` into `repo`, or past both into the DB schema, runs the *right* way and is silent here. That is [boundary/layer-occupancy](../boundary/layer-occupancy.md), which asks a different question — whether the skipped layer exists on disk — and needs the layer names by name to ask it. The two rules get conflated constantly. Direction and occupancy are independent: an edge can be wrong under either, both, or neither, and one check answering both is a check nobody can predict.

**A file at a feature root is not this rule's finding — except the barrel.** An ordinary root file has no layer, so no edge touching it can run upward or downward. Whether it belongs there at all is `placement/topology`'s question, and answering it here means an absent layer needs a rank — which it acquires by accident, `-1` from an `indexOf` or `0` from being treated as the top, and either one invents violations against ordinary code.

**It says nothing about whether an edge should exist.** Only which way it runs. A `ui`→`service` import that skips `controllers` entirely, a feature importing a domain, a service importing a package — all outside.

**Type-only edges are reported like any other.** The graph marks them and this rule ignores the marking: a type flowing upward inverts the dependency exactly as a value does, and the layer below still cannot be read without the layer above. Rules that skip erased coupling are the ones reasoning about runtime dependency, which this is not.

**An edge the graph could not place in the text is reported against the file with no line.** A specifier written with a unicode escape comes back from the reader cooked and matches no literal in the source. The file alone is a worse finding than a located one and a much better one than a wrong line — this check blocks, so a line number sends someone somewhere.

**Coverage is exactly the graph's coverage.** The forms `graph/import-graph.md` lists as unrevealed are edges this rule never receives. Widening a matcher here rather than the extractor there is how two rules end up governing different sets of imports while claiming the same scope.

## Adapt

One knob: **`config.source.layerOrder`**, highest to lowest.

```typescript
layerOrder: ["ui", "controllers", "service", "repo"]
```

A project with a different stack restates it here in its own order and the rule follows — the names are not special to the check, and their *positions* are the entire definition of "upward". A project inserting a layer, say `orchestration` between `controllers` and `service`, adds it in position here and is done: this rule, the graph's classification of which directory segments count as layers at all, and every other consumer of the order move together. That single point of change is most of the argument for building the import graph once instead of letting each rule match specifiers on its own — a fourth rule with its own private list is a fourth place the new layer has to be remembered, and the one that gets forgotten fails silently.

Two things deliberately have no knob. There is **no exclusion list**: a path excluded from this rule is a path whose layer boundaries have stopped being enforced, and nothing would say so. And **the severity is not configurable** — an upward edge that only warns is an upward edge that ships, and the cost of it is paid by whoever next tries to split the two layers apart.

At adoption an existing codebase will have upward edges already. Fix them rather than filtering them; if the count is large, that is a statement about how much of the layering is currently notional.

## Example output

```
FAIL [placement/layer-direction] src/features/layers/repo/nested/deep.ts:7
  "../../service/queries.ts" runs upward: repo imports from service.
  Direction is ui -> controllers -> service -> repo, highest to lowest, and an import may
  only run down it. Move what both layers need down into repo, or out
  to a domain, or invert the call so service drives repo.
  Downward imports are the normal direction and stay unreported.

FAIL [placement/layer-direction] src/features/layers/repo/root.ts:8
  "@/features/layers/controllers/handlers.ts" runs upward: repo imports from controllers.
  …
```

The second is the same violation as the first with a different spelling, and the message names the specifier as written rather than the resolved path — the reader has to find the line in their own file.

## Fixtures

The barrel arm carries three of its own. The relative `../index.ts` and the aliased `@/features/<self>` are the same edge in the two spellings a feature writes it in — the aliased one is what an editor's auto-import produces, so it is the likelier of the two. The legal neighbour is a layer importing *another* feature's barrel, which is the ordinary way one feature uses another: an arm that compares the path shape instead of the feature name reports every cross-feature import in the repo.

The three direction violations are one edge in three spellings, which is the rest of the test. The plain `../service/…` from `repo/` is the regression guard: it is the only one a specifier pattern already caught, and resolving properly had to keep it. The nested `../../service/…` and the same-feature aliased climb are what a pattern loses — the first because it expected one `../`, the second because it expected any `../` at all.

The legal neighbours carry as much weight, because over-matching is invisible to every positive case. A `ui/` file importing `../service/…` uses the specifier the obvious case is *reported* for, character for character, so only the importing file's own layer separates them. A `service/` file importing its sibling sits exactly on the line, which is the only way to see a `>=` where a `>` belongs. And a `ui/` file importing the feature-root `errors.ts` is the half-layered edge: it fires under an implementation that lets an absent layer take a rank, and under no correct one.
