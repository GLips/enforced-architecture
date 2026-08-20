# boundary/import-policy

| Field | Value |
|---|---|
| **Tag** | boundary |
| **Mechanism** | Structural check (resolved import graph, pre-commit + CI) |
| **Blocking** | Yes |

## What it prevents

Two things, from one table:

1. **A relative import that is forbidden.** Where `../../billing/repo/queries` lands is a function of how deep the importing file sits, so the specifier has to be resolved before anything can judge it. Once resolved, it is judged by the same policy the linter applies to the aliased spelling.
2. **A permitted crossing written relatively.** The edge is legal; hiding it is not. Every specifier-matching rule in the catalog reads the *aliased* form, so a crossing written relatively names the same module with a string none of them see.

Both come from one call into [lint/policy/import-policy.ts](../../policy/import-policy.ts). This check holds no policy of its own — it resolves, it asks, it renders.

```ts
// src/features/alpha/ui/panel.tsx
import { chargeCard } from "../../billing/service/charge";   // reaches features/billing
```

That is a cross-feature deep import *and* a hidden crossing. The linter's half of the policy is looking for `@/features/billing/service/charge`, a specifier that never appears.

## Why this is a script and not a lint rule

The question cannot be answered from the import string at all. A per-file lint rule matching the specifier catches the long climbs — `../../../shared/lib/x` still carries a directory name a pattern can find — and misses the sibling feature entirely, because `../../beta/…` from `features/alpha/ui/` contains no `features/` segment for the pattern to key on. That is the shortest spelling of a crossing, the most innocuous to read, and therefore the likeliest one to be written. A rule that catches only the loud half of a bypass is a rule that certifies the quiet half.

The resolution is not this check's work. It consumes the shared edge list from [graph/import-graph.md](../graph/import-graph.md), which is also what makes the answer agree with `placement/layer-direction` and `boundary/layer-occupancy` instead of being one of three private opinions about where an import lands.

## Why every relative edge is passed, and none are pre-filtered

`boundary/cross-boundary-alias`, which this replaces, selected on `edge.from.boundary !== edge.to.boundary`. That selector had a hole with a live example in it: `src/shared/ui/**` and `src/shared/**` are ONE boundary, so a primitive reaching a shared utility relatively was seen by nothing — the shared-ui rule matched only `@/` specifiers, and the boundary comparison stayed quiet.

The policy engine draws a finer line. `shared/ui` and `shared` are one boundary and two **units**, and unit identity is what decides whether an edge is internal. The selector is gone rather than widened, because any future nested profile would have recreated the same hole.

## Where it applies

Every relative edge in the import graph. There is no per-directory scoping and no exclusion list: a path excluded from this check is a path excluded from the whole import policy at the same time, and nothing would say so.

Three classes of edge are outside it by construction, and each is a false positive if the general case handles it:

- **Aliased specifiers and bare packages** belong to `arch/import-policy` in the oxlint tier, which sees them without resolving anything. The split is inherent in the data rather than a partition anyone maintains.
- **Asset specifiers** — `../styles.css?url`, an imported SVG or font — resolve inside the source tree and are not module edges. The graph drops them via `source.assetExtensions`.
- **Anything landing outside the source root** is a dependency question, not a placement one.

## Negative space

**Files in the source root are one unit.** `client.tsx` importing `./router` crosses nothing. An implementation reading "the first path segment" as the boundary invents a crossing there, which is the first thing this class of check gets wrong.

**It says nothing about layer direction.** A same-unit edge returns `internal` and this check drops it. Whether it runs the wrong way through a feature's layers is `placement/layer-direction`; whether it bypasses an occupied layer is `boundary/layer-occupancy`.

**Type-only edges are reported like any other, except for one row.** The graph marks them and the policy reads the mark in exactly one place: a domain's runtime imports are narrower than its type imports, because a type import is erased. Everywhere else the marking changes nothing — a forbidden direction is forbidden for a type too, since the coupling it creates is what the row is about.

**An edge the graph could not place in the text is reported against the file with no line.** A specifier written with a unicode escape comes back from the reader cooked and matches no literal in the source. The file alone is a worse finding than a located one and a much better one than a wrong line — this check blocks, so a wrong line sends someone somewhere.

**An unclassified source file is reported once, not once per import.** It is a fact about the file. The oxlint tier reports it too, including for a file with no imports at all, which this tier cannot see; the duplication is deliberate, because a check that depends on another check's completeness is the failure this policy exists to remove.

**Coverage is exactly the graph's coverage.** The forms `graph/import-graph.md` lists as unrevealed are edges this check never receives. Widening the matcher here rather than the extractor there is how two rules end up governing different sets of imports while claiming the same scope.

## Adapt

Nothing in this file, and nothing in the check. The policy is [lint/policy/import-policy.ts](../../policy/import-policy.ts) and the shape of the tree is [lint/policy/layout.ts](../../policy/layout.ts); the structural tier's `arch.config.ts` should take `roots`, `aliasPrefix`, `subdividedDirs`, `layerOrder` and `assetExtensions` from that module rather than restating them, so the two tiers cannot end up policing two different trees while both report clean.

The only real adjustment is at adoption: an existing codebase will have crossings already. Fix them rather than filtering them.

## Example output

```
FAIL [boundary/import-policy] src/features/alpha/ui/panel.tsx:4
  a feature's ui/ layer may import a feature only through its barrels,
  @/features/billing and @/features/billing/index.server, and "../../billing/service/charge"
  reaches features/billing/service/charge. …

FAIL [boundary/import-policy] src/features/alpha/ui/sibling-crossing.ts:3
  "../../beta/service/beta-thing.ts" leaves features/alpha and lands in features/beta.
  Write it as "@/features/beta/service/beta-thing.ts" instead. …

FAIL [boundary/import-policy] src/features/alpha/ui/escaped-specifier-crossing.ts
  …
```

The last has no `:line`, and that is the lineless case rather than a formatting bug.

## Fixtures

The two that decide the resolution: a sibling-feature crossing, which a spelling matcher cannot see, and a long climb to another top-level boundary, which it can — the second is the regression guard, since resolving properly had to keep what a pattern already got right.

Then the extractor's blind spots, each carrying a *real* crossing inside the affected span: wrapped `from`, `import()` and `require()` specifiers; a backtick in a quoted string and another in a regex literal; a crossing inside a `${…}` interpolation; a generic arrow in a plain `.ts` file; a shebang; and a unicode-escaped specifier. Written with a legal import instead, each edge is lost just the same and the suite stays green.

The legal neighbours carry as much weight as the violations, because over-matching is invisible to every positive case: two source-root files importing each other, relative imports landing inside the same unit in both the plain and the wrapped spelling, a code sample in a template literal, and `../styles.css?url` from a route.

The engine's own cases — that a path reaches the cell its author intended, and that one edge spelled two ways reaches one verdict — are the oxlint tier's, at [lint/policy/import-policy.test.ts](../../policy/import-policy.test.ts). They are pure and need no tree.
