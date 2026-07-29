# graph/import-graph

| Field | Value |
|---|---|
| **Tag** | graph |
| **Mechanism** | Structural script — the shared substrate, not a rule itself |
| **Blocking** | Its consumers are |

Not a rule. This is the resolved import graph that four rules consume instead of each matching import strings on its own: `boundary/cross-boundary-alias`, `structure/layer-direction`, `boundary/layer-occupancy`, and `graph/feature-deps`. Build it once in the shared `lib.ts`.

## Why these rules cannot be GritQL

Each of them asks **where an import lands**. GritQL can only see **how it is spelled**, and the two come apart the moment a directory nests:

```ts
// from src/features/alpha/ui/panel.tsx
import { x } from "../../beta/service";   // leaves the feature — names no directory a regex can match
// from src/features/alpha/repo/nested/deep.ts
import { x } from "../../service/x";      // climbs a layer — the pattern expected one ../
// from src/features/alpha/repo/root.ts
import { x } from "@/features/alpha/controllers/x";  // climbs a layer, written as an alias
```

A regex over the specifier cannot answer any of these, because the answer depends on how deep the *importing* file sits. This is a fourth trigger for reaching past GritQL, alongside cross-file analysis, filesystem awareness, and counting: **the answer is a function of the importing file's location, not of the import string.**

The failure is worse than a miss. Every other boundary rule matches the *aliased* form of a path, so a cross-boundary import written relatively names the same module with a string none of those rules see. It is not a style preference — it is a working bypass for the whole `boundary/` tag, and it reads as ordinary code.

## Algorithm

1. **Collect source files** via the shared library's walker.
2. **Extract every module specifier from the TypeScript AST** — static imports, `export … from`, side-effect imports, dynamic `import()`, and `require()`. Line regexes lose multi-line forms and `require` silently; a cycle built out of side-effect imports is invisible to a graph that only recorded `from` clauses.
3. **Resolve each specifier** against the importing file: relative paths through `resolve(dirname(file), specifier)`, aliased paths by stripping the alias prefix. Discard anything landing outside the source root — that is a package or a config question, not a boundary one.
4. **Classify both ends** into `{ boundary, feature, layer }`.
5. **Hand consumers the edge list.** Every question below is then a comparison of two classifications, and depth and spelling stop mattering.

### Classification

A **boundary** is a top-level directory, except under the subdivided ones — `features/` and `domains/` — where each named feature or domain is its own:

```typescript
const SUBDIVIDED = new Set(["features", "domains"]);

function boundaryOf(pathFromSourceRoot: string): string {
  const [top, second] = pathFromSourceRoot.split("/");
  // No directory component means a file sitting directly in the source root —
  // an entrypoint, the env module, a generated route tree. They share ONE
  // boundary. Naming each such file its own boundary makes `./env.client` from
  // `client.tsx` read as a crossing, which is the first false positive this
  // check produces if you let the general case handle them.
  if (top === undefined || second === undefined) return sourceRootName;
  return SUBDIVIDED.has(top) ? `${top}/${second}` : top;
}
```

A **layer** is the first segment inside a feature, when it is one of the configured layer names. A file at a feature root has no layer — which is itself a finding, see [structure/topology](../structure/topology.md).

**Adjust `SUBDIVIDED`** to the project's shape. It is not always these two: a project whose `src/` subdivides `packages/` or `modules/` one level down needs those instead.

**Drop asset specifiers** (`../styles.css?url`, an imported SVG or font) before classifying. They resolve inside the source root and are not module edges, so they otherwise surface as a boundary crossing with a filename where a boundary name should be.

## What each consumer asks

| Rule | The question | Fires when |
|---|---|---|
| `boundary/cross-boundary-alias` | Do both ends share a boundary? | They differ **and** the specifier was relative. Relative imports *within* one boundary cross nothing and stay unreported. |
| `structure/layer-direction` | Do both ends sit in the same feature, and does the edge run upward? | The target's layer is above the source's in the configured order. Covers relative and aliased spellings identically. |
| `boundary/layer-occupancy` | Does the edge skip a layer that exists on disk? | A present layer is bypassed. "Skip absent layers, never bypass present ones." |
| `graph/feature-deps` | What is the feature-to-feature edge set? | Cycles (Tarjan's SCC) block; coupling counts warn. |

## Configuration

```typescript
const LAYER_ORDER = ["ui", "controllers", "service", "repo"] as const;  // highest to lowest
const SUBDIVIDED = new Set(["features", "domains"]);
const ALIAS_PREFIX = "@/";
```

**Adjustments:** layer names and order follow the project's chosen intra-feature structure; a project that inserts a layer adds it to `LAYER_ORDER` in position and every consumer follows without further edits. That single-point-of-change is most of the argument for building the graph once.

## Counting features

`feature-deps` needs at least two features to have a subject. Count directories **containing at least one source file** — an empty leftover directory otherwise manufactures a subject, and the check reports a passing result over a set it never really had. Print `no subject` rather than `clean` below the threshold, so a green line never stands in for coverage that is not there.

## Example output

```
FAIL [cross-boundary-alias] src/features/alpha/ui/panel.tsx:4
  "../../beta/service" leaves features/alpha and lands in features/beta.
  Write it as "@/features/beta" instead. Every other boundary rule matches on the
  aliased path, so the relative spelling of a cross-boundary import is a bypass that
  no rule sees. Relative imports stay correct inside one boundary — they cross nothing.

FAIL [layer-direction] src/features/alpha/repo/nested/deep.ts:2
  repo imports from service. Direction is ui -> controllers -> service -> repo, and
  repo is the floor. Move what both layers need down here, or out to a domain.
```

## Fixtures

The three that decide whether this works, all of which pass a spelling-matched implementation: a sibling-feature import (`../../beta/…`), an upward import from a nested directory (`../../service/x`), and a same-feature *aliased* upward import. Add a `require()` edge and a side-effect import edge for the extractor. See *Rule Fixtures* in [enforcement-implementation.md](../../enforcement-implementation.md).
