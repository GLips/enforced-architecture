# boundary/cross-boundary-alias

| Field | Value |
|---|---|
| **Tag** | boundary |
| **Mechanism** | Structural script (resolved import graph, pre-commit + CI) |
| **Blocking** | Yes |

## What it prevents

A relative import leaving the boundary it is written in.

Every other rule in the `boundary/` tag matches the *aliased* form of a path — `@/domains/…`, `@/infrastructure/db/…`, `@/features/<other>/…`. A crossing written relatively names the same module with a string none of those rules see:

```ts
// src/features/alpha/ui/panel.tsx
import { chargeCard } from "../../billing/service/charge";   // reaches features/billing
```

`domain-purity`, `db-isolation`, `shared-purity` and the rest of the tag are looking for a specifier that never appears. This is not a style preference and not a tidiness argument: it is a working bypass for the whole tag, available to anyone who writes the shorter spelling, and it reads as completely ordinary code. That is why it blocks — a warning lets the bypass accumulate, and each accumulated instance is a boundary nobody is enforcing.

The corollary matters as much. **Relative imports inside one boundary cross nothing and are never reported.** Relative paths are how a module moves within its own boundary, and a check that reports them is one that gets switched off within a week — taking the crossings it was written for with it.

## Why this is a script and not a lint rule

The question cannot be answered from the import string at all. Whether `../../beta/service/x` leaves the current boundary depends on how deep the *importing* file sits, so the specifier has to be resolved against the tree and both ends compared.

A per-file lint rule matching the specifier catches the long climbs — `../../../shared/lib/x` still carries a directory name a pattern can find — and misses the sibling feature entirely, because `../../beta/…` from `features/alpha/ui/` contains no `features/` segment for the pattern to key on. That is the shortest spelling of a crossing, the most innocuous to read, and therefore the likeliest one to be written. A rule that catches only the loud half of a bypass is a rule that certifies the quiet half.

The resolution is not this rule's work. It consumes the shared edge list from [graph/import-graph.md](../graph/import-graph.md), which is also what makes the answer agree with `placement/layer-direction` and `boundary/layer-occupancy` instead of being one of three private opinions about where an import lands.

## Where it applies

Every edge in the import graph, which is every source file under the graph's source root. There is no per-directory scoping: a boundary crossing is a boundary crossing wherever it is written.

Three classes of edge are outside the rule by construction, and each one is a false positive if you let the general case handle it:

- **Files sitting directly in the source root** share one boundary. They have no directory component, so an implementation reading "the first path segment" as the boundary calls `./router` from `client.tsx` a crossing.
- **Asset specifiers** — `../styles.css?url`, an imported SVG or font — resolve inside the source tree and are not module edges. They otherwise surface as a crossing with a filename where a boundary name should be.
- **Anything landing outside the source root** — a package name, a path climbing past `src/` — is a dependency question, not a boundary one.

## Negative space

**It does not police the aliased spelling.** An aliased cross-boundary import is *visible* to the rest of the tag; whether it is permitted is that rule's business. This one closes the spelling gap and nothing else.

**It says nothing about direction.** `features/alpha` importing `features/beta` and the reverse are the same finding here. Whether the edge should exist is `graph/feature-deps` and `api/feature-visibility`; whether it runs the wrong way through the layers is `placement/layer-direction`.

**Type-only edges are reported like any other.** The graph marks them, and this rule ignores the marking on purpose: the bypass is that no boundary rule sees the string, and a type import is as invisible as a runtime one. Rules that skip erased coupling are the ones reasoning about runtime dependency, which this is not.

**An edge the graph could not place in the text is reported against the file with no line.** A specifier written with a unicode escape comes back from the reader cooked and matches no literal in the source. The file alone is a worse finding than a located one and a much better one than a wrong line — this check blocks, so a line number sends someone somewhere.

**Coverage is exactly the graph's coverage.** The forms `graph/import-graph.md` lists as unrevealed — a comment between `import` and `type`, a brace inside a clause comment, `type C = import("./c").C` — are edges this rule never receives. It cannot report what it is not handed, and widening the matcher here rather than the extractor there is how two rules end up governing different sets of imports while claiming the same scope.

## Adapt

Nothing to configure. The rule reads three things, and all of them belong to the source config every graph consumer shares:

- `source.subdividedDirs` decides where a boundary is a top-level directory and where it is one level down. A project whose `src/` subdivides `packages/` or `modules/` names those instead, and this rule follows without an edit.
- `source.aliasPrefix` is what the suggested fix is written with. The message names the resolved target under that prefix, so the fix is a path to paste rather than a shape to work out.
- `source.assetExtensions` is the exemption above. Extend it to whatever the project's bundler lets a module import.

The only real adjustment is at adoption: an existing codebase will have crossings already. Fix them rather than filtering them — this rule has no exclusion list, deliberately, because a path excluded from it is a path excluded from every other boundary rule at the same time and nothing says so.

## Example output

```
FAIL [boundary/cross-boundary-alias] src/features/alpha/ui/panel.tsx:4
  "../../beta/service/beta-thing.ts" leaves features/alpha and lands in features/beta.
  Write it as "@/features/beta/service/beta-thing.ts" instead. The boundary rules all
  match the aliased path, so the relative spelling of a crossing is a bypass
  none of them see. Relative imports stay correct inside one boundary — they
  cross nothing, and this check leaves them alone.

FAIL [boundary/cross-boundary-alias] src/features/alpha/ui/escaped-specifier-crossing.ts
  "../../beta/service/beta-thing.ts" leaves features/alpha and lands in features/beta.
  …
```

The second has no `:line`, and that is the lineless case rather than a formatting bug.

## Fixtures

The two that decide it: a sibling-feature crossing, which a spelling matcher cannot see, and a long climb to another top-level boundary, which it can — the second is the regression guard, since resolving properly had to keep what a pattern already got right.

Then the extractor's blind spots, each carrying a *real* crossing inside the affected span: wrapped `from`, `import()` and `require()` specifiers; a backtick in a quoted string and another in a regex literal; a crossing inside a `${…}` interpolation; a generic arrow in a plain `.ts` file; and a unicode-escaped specifier. Written with a legal import instead, each edge is lost just the same and the suite stays green.

The legal neighbours carry as much weight as the violations, because over-matching is invisible to every positive case: two source-root files importing each other, relative imports landing inside the same feature in both the plain and the wrapped spelling, a code sample in a template literal, and `../styles.css?url` from a route.
