# graph/import-graph

| Field | Value |
|---|---|
| **Tag** | graph |
| **Mechanism** | Structural script — the shared substrate, not a rule itself |
| **Blocking** | Its consumers are |

Not a rule. This is the resolved import graph that five rules consume instead of each matching import strings on its own: `boundary/cross-boundary-alias`, `structure/layer-direction`, `boundary/layer-occupancy`, `graph/feature-deps`, and `graph/domain-cycles`. Build it once in the shared `lib.ts`.

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
2. **Extract every module specifier with a real reader** — `Bun.Transpiler.scanImports`, never a pattern over the source. See [Extraction](#extraction) below; this is the step where silent failure lives.
3. **Resolve each specifier** against the importing file: relative paths through `resolve(dirname(file), specifier)`, aliased paths by stripping the alias prefix. Discard anything landing outside the source root — that is a package or a config question, not a boundary one.
4. **Classify both ends** into `{ boundary, feature, layer }`, and **keep the resolved target path alongside them.** Classification alone collapses distinctions a consumer still needs — `layer-occupancy` has to tell `infrastructure/db/schema` from `infrastructure/db/client`, and both classify as `infrastructure`. A consumer that matches the raw specifier instead is back to matching spellings, which is the bypass this tier exists to close.
5. **Hand consumers the edge list.** Every question below is then a comparison of two classifications plus, where a rule names specific modules, a comparison of resolved paths. Depth and spelling stop mattering either way.

```typescript
type ImportEdge = {
  file: string;                    // importing file, project-relative
  line: number | undefined;        // see Extraction — undefined is a real case
  specifier: string;               // as written, for the error message only
  relative: boolean;
  target: string;                  // RESOLVED path from the source root
  typeOnly: boolean;               // see Extraction — per specifier, not per file
  from: Classification;
  to: Classification;
};
```

Consumers that ask only "do these ends differ" need `from`/`to`. `target` is for rules that name specific modules, and `typeOnly` for rules that skip erased coupling. Carry all three: a consumer missing one reaches for the raw specifier, which is the bypass this tier exists to close.

### Extraction

**Use `Bun.Transpiler.scanImports`. Do not write a pattern that matches import statements.** It lexes the source the way a compiler does, so it decides where code ends and text begins instead of guessing. Bun documents `scanImports` as possibly marginally less accurate than `scan()`; that is a tradeoff against a pattern-matcher's failure mode, not a tie.

That is the whole question here, and it is a lexer's: comments, both quote styles, template literals, `${…}` holes, templates nested in those holes, escapes, regex literals, JSX text. Get one wrong and a pattern pairs the wrong delimiters and swallows every statement between them. **Silently** — a matcher that stops matching reports nothing, so a clean run is indistinguishable from a working one, and the loss surfaces only through a fixture written to catch it.

```typescript
// One reader PER SYNTAX FAMILY, not per file. Under the `tsx` loader a generic
// arrow in a plain .ts file — `const stamp = <T>(rows: T[]) => …` — is read as
// an unclosed JSX tag and the reader THROWS. Nothing catches it, so one such
// file aborts the whole graph rather than losing its own edges. Readers hold no
// per-file state, so they live for the whole run.
const READERS = {
  ts: new Bun.Transpiler({ loader: "ts" }),    // .ts, .mts, .cts
  tsx: new Bun.Transpiler({ loader: "tsx" }),  // .tsx
} as const;                                    // add js/jsx if the walker collects them

// A shebang is valid at the top of an executable source file and the reader
// rejects it outright — another whole-run abort. Blanked rather than stripped,
// so every later offset still maps to the right line.
const source = raw.replace(/^#![^\n]*/, (match) => " ".repeat(match.length));

const specifiers = (path.endsWith(".tsx") ? READERS.tsx : READERS.ts)
  .scanImports(source)
  .map((entry) => entry.path);
```

It returns static imports, `export … from`, side-effect imports, dynamic `import()` and `require()` — each tagged with its `kind` — and it is unmoved by every shape a pattern gets wrong. Statically analysable literal specifiers only: `require("./" + name)` has no path to return.

**Catch a scan failure and rethrow it with the file path.** A bare `error: Syntax Error at input.tsx:11` names a file nobody has, which is poor output from a check whose whole job is telling someone where to look.

#### It reports imports that are not in the file

Under a JSX loader, `scanImports` returns the JSX runtime imports **Bun injects**, which appear nowhere in the source. One `import { useState } from "react"` in a `.tsx` file comes back as three entries:

```
{ kind: "import-statement", path: "react" }              // the real one
{ kind: "require-call",     path: "react/jsx-dev-runtime" }   // injected
{ kind: "require-call",     path: "react" }                   // injected, a duplicate
```

They are **not** tagged `internal` — they arrive as `require-call`, indistinguishable from a real `require()`. `scan()` filters them; `scanImports()` does not. Two consequences:

- **Counts per specifier are inflated,** so a lookup expecting two occurrences of `"react"` finds one and the extra edge comes back lineless. Harmless in the graph, because bare specifiers are discarded before classification anyway — measured across two real repos, `scanImports` was a strict superset of `scan` and never lost an edge.
- **A check whose subject IS bare package names must filter or use `scan()`.** That is `api/barrel-purity`: a blocklist pattern matching an injected path reports a file that imports no such thing.

#### The two things the reader will not do

**It gives you no line numbers.** Locate the specifier literal in the text yourself:

```typescript
const needles = [`"${specifier}"`, `'${specifier}'`];   // indexOf, not a regex —
                                                        // a specifier can hold regex metacharacters
```

Take the reader as the authority on *which* specifiers exist and *how many* times; use the text only to find *where*. That inverts the risk: prose quoting the same path can claim a line ahead of the real import, which costs a wrong line number on a finding you still report — never a lost finding.

Three things to get right, because this lookup is **best-effort by construction**:

- **A repeated path needs consumed occurrences,** not `indexOf` from zero each time. Collect every offset for the specifier, sort them, and take as many as the reader reported.
- **The reader returns the COOKED path,** so a specifier written with an escape — `import "./f\u006fo"` comes back as `./foo` — matches no literal in the text at all. **Report the file with no line. Do not throw:** nothing catches it, so one such import anywhere aborts the whole graph. Do not fall back to line 1 either — a wrong line on a blocking check sends someone to the wrong place. That means the line is `number | undefined` in the edge type and every consumer formats around it.
- **Source order is observed behaviour, not documented API.** Don't make correctness depend on it: group by specifier, then sort by line at the end.
- **Blank comments before the lookup,** or a commented-out import claims the line of the real one below it. Blank, don't strip, so offsets stay aligned. Only for the lookup — feed the reader raw source; it lexes comments correctly, backticks inside them included.

**It erases type-only imports.** They emit no runtime code, so `scanImports` drops `import type`, `export type … from`, `import type X = require(…)`, and an all-inline `import { type A }`. A type-only import across a boundary is still coupling, so scan a second time with the type keywords removed and union the two results per specifier:

```typescript
const IMPORT_CLAUSE = /\b(?:import|export)\s*\{[^{}]*\}\s*from\s*["'][^"']+["']/g;

function revealTypeImports(source: string): string {
  return source
    .replace(/\bimport\s+type\b/g, "import")            // always an import — safe
    .replace(/\bexport\s+type\s+(?=[{*])/g, "export ")  // re-export forms ONLY
    .replace(IMPORT_CLAUSE, (clause) => clause.replace(/([{,]\s*)type\s+/g, "$1"));
}
```

The narrowness is load-bearing, because **the reader throws on code it cannot parse rather than tolerating it**, and nothing catches that — one unparseable file aborts the whole graph, not just its own edges:

- `export type` usually opens a type *alias*. Stripping it turns `export type Foo = …` into `export Foo = …` and takes the run down. Only `export type {` and `export type *` may be touched.
- Inline `{ type A }` may only be stripped inside a span already matched as an import clause ending in `from "…"`. Applied loosely, it turns a local `function f() { type A<T> = T }` into a parse error.

Union rather than substitute, so a shape none of these reveal can never cost a **runtime** edge — the first scan already had it.

**An unrevealed shape costs the whole type-only edge, not just its marking.** These are all valid and neither scan sees any of them:

```ts
import /* why */ type { A } from "./a";     // a comment between the keywords
export type /* why */ { B } from "./b";
import { type A /* } */ } from "./a";       // a brace in a comment ends the clause match early
type C = import("./c").C;                   // an import type in a type position
type D = typeof import("./d");
```

So pick a policy deliberately rather than inheriting this one:

1. **Simplest, and the right default.** Build the runtime graph from `scanImports` alone and state plainly that erased type coupling is not represented. A rule that under-reports on a documented axis beats one that claims completeness it does not have.
2. **Best-effort augmentation.** Keep the reveal scan, label it incomplete, list the forms above as known-missing, wrap the second scan so its failure cannot abort or replace the runtime graph, and fixture all four replacements — statement `import type`, `export type` re-exports, `import type X = require(…)`, and an all-inline `import { type A }`.
3. **When complete type coupling actually matters,** use the TypeScript compiler AST. A source rewrite is the wrong foundation for an invariant you intend to claim.

If a consumer needs to *skip* type-only edges, mark a specifier type-only only when the file has **no** runtime import of that same specifier — a file with both spellings reports every occurrence as runtime, which is the loud direction.

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
| `graph/domain-cycles` | Same question between domains. | Any cycle, at any transitive depth. Domains are the floor, so a cycle there means two domains are one. |

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

The three that decide whether resolution works, all of which pass a spelling-matched implementation: a sibling-feature import (`../../beta/…`), an upward import from a nested directory (`../../service/x`), and a same-feature *aliased* upward import. Add a `require()` edge and a side-effect import edge for the extractor.

Then fixture the extractor against the shapes that make a pattern lose a file. Each of these needs a **real violation** inside the affected span — written with a legal import instead, the edge is lost just the same and the suite stays green:

| Fixture | Guards |
|---|---|
| A crossing between a backtick in a quoted string and the next real template | The reader classifies delimiters; a pattern swallows the span between them |
| A crossing after a regex literal containing a backtick | Same failure, from a syntax class a string-only fix does not cover |
| A crossing inside a `${…}` interpolation | Interpolations are code. Blanking a template wholesale — the obvious way to stop prose being read as an import — deletes a real edge |
| A code sample in a template literal, expected **silent** | The other half of that pair. This check blocks, so documentation would fail the commit |
| A wrapped `import`, `require`, `from`, and `export … from` | All four spellings, since a formatter breaks any of them once the line gets long |
| A type-only import of one module beside a runtime import of another | The type-only marking is per specifier, not per file |
| A generic arrow (`const f = <T>(x: T[]) => …`) in a plain `.ts` file | The per-extension loader. Under `tsx` this throws and takes the whole run with it |
| A file starting with a shebang | Same abort, different cause |
| A crossing whose specifier is written with a `\u` escape | The lineless path, which aborts the graph if it throws |

See *Rule Fixtures* in [enforcement-implementation.md](../../enforcement-implementation.md).
