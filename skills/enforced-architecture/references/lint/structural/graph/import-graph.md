# graph/import-graph

| Field | Value |
|---|---|
| **Tag** | graph |
| **Mechanism** | Structural check — the shared substrate, not a rule itself |
| **Blocking** | Its consumers are |

Implementation: [../import-graph.ts](../import-graph.ts) — at the tier root rather than in this
folder, because six rules across four tags consume it and it belongs to none of them. The doc sits
under `graph/` because `graph/import-graph` is the id those rules cite.

Not a rule. This is the resolved import graph six rules consume instead of each matching import strings on its own: `boundary/cross-boundary-alias`, `placement/layer-direction`, `boundary/layer-occupancy`, `graph/feature-deps`, `graph/domain-cycles`, and `api/feature-visibility`. Built once by `CheckContext.importGraph()` and shared; no rule scans files for imports itself.

`api/barrel-purity` is the one rule that reads imports and does **not** take the graph. Resolution discards bare package specifiers as "not a boundary question", and bare package names are that rule's entire subject. It shares the extraction instead — `scanDeclaredImports`, exported from the same module — because the union and the JSX filter are where the silent losses live, and two copies of those drift without either copy reporting that it has.

## Why these rules cannot be per-file lint rules

Each of them asks **where an import lands**. A lint rule matching the specifier only sees **how it is spelled**, and the two come apart the moment a directory nests:

```ts
// from src/features/alpha/ui/panel.tsx
import { x } from "../../beta/service";   // leaves the feature — names no directory a regex can match
// from src/features/alpha/repo/nested/deep.ts
import { x } from "../../service/x";      // climbs a layer — the pattern expected one ../
// from src/features/alpha/repo/root.ts
import { x } from "@/features/alpha/controllers/x";  // climbs a layer, written as an alias
```

A pattern over the specifier cannot answer any of these, because the answer depends on how deep the *importing* file sits. A per-file rule gets partway — `context.filename` is enough to resolve a relative specifier by path arithmetic — but it cannot see what that path lands on in the tree, and it cannot see the reverse edge that `graph/domain-cycles`, `graph/feature-deps` and `api/feature-visibility` each ask about. Resolve once, hand every consumer the same edge list. This is a fourth trigger for reaching past the per-file lint tier, alongside cross-file analysis, filesystem awareness, and counting across a file set: **the answer is a function of the importing file's location, not of the import string.**

The failure is worse than a miss. Every other boundary rule matches the *aliased* form of a path, so a cross-boundary import written relatively names the same module with a string none of those rules see. It is not a style preference — it is a working bypass for the whole `boundary/` tag, and it reads as ordinary code.

## What each consumer asks

| Rule | The question | Fires when |
|---|---|---|
| `boundary/cross-boundary-alias` | Do both ends share a boundary? | They differ **and** the specifier was relative. Relative imports *within* one boundary cross nothing and stay unreported. |
| `placement/layer-direction` | Do both ends sit in the same feature, and does the edge run upward? | The target's layer is above the source's in the configured order. Covers relative and aliased spellings identically. |
| `boundary/layer-occupancy` | Does a controller edge bypass an on-disk repo or service? | Controller→schema while `repo/` exists, or controller→repo while `service/` and `repo/` exist. |
| `graph/feature-deps` | What is the feature-to-feature edge set? | Cycles (Tarjan's SCC) block; coupling counts warn. |
| `graph/domain-cycles` | Same question between domains. | Any cycle, at any transitive depth. Domains are the floor, so a cycle there means two domains are one. |
| `api/feature-visibility` | Same edge set again — did the importee grant this one? | The importee's `visibility.json` omits the importer. Reads the classification, so a relative spelling needs the same grant. |

Every consumer gets `from`/`to` classifications, the **resolved** `target` path, and a `typeOnly` flag. All three are carried because a consumer missing one reaches for the raw specifier, which is the bypass this tier exists to close: `boundary/layer-occupancy` has to tell `infrastructure/db/schema` from `infrastructure/db/client`, and both classify as `infrastructure`.

## What the reader will not do

Two facts about Bun's readers that the implementation works around, and that anyone changing it needs to know before deciding a workaround is dead weight.

**It gives no line numbers.** The specifier literal is located in the text, which makes the line **best-effort by construction**: the reader returns the *cooked* path, so a specifier written with an escape (`import "./foo"`) matches no literal in the file. That edge is reported with **no line** rather than line 1 — a wrong line on a blocking check sends someone to the wrong place — which is why `line` is `number | undefined` and every consumer formats around it. Take the reader as the authority on *which* specifiers exist and *how many* times; use the text only to find *where*.

**It erases type-only imports.** A type crossing a boundary is still coupling, so the source is scanned a second time with the type keywords removed and the two results are unioned per specifier. Several valid spellings are not revealed by that rewrite and are lost entirely:

```ts
import /* why */ type { A } from "./a";     // a comment between the keywords
export type /* why */ { B } from "./b";
import { type A /* } */ } from "./a";       // a brace in a comment ends the clause match early
type C = import("./c").C;                   // an import type in a type position
type D = typeof import("./d");
```

This implementation takes **policy 2** below. Pick deliberately rather than inheriting it:

1. **Simplest, and the right default for a new project.** Build the runtime graph from the union alone and state plainly that erased type coupling is not represented.
2. **Best-effort augmentation.** Keep the reveal scan, label it incomplete, list the forms above as known-missing, and wrap the second scan so its failure can never abort or replace the runtime graph. The union — rather than substitution — is what makes an unrevealed shape cost a type-only *marking* and never a runtime *edge*.
3. **When complete type coupling actually matters,** use the TypeScript compiler AST. A source rewrite is the wrong foundation for an invariant you intend to claim.

## Negative space

- **A specifier is never matched with a pattern.** Prose in a template literal, a backtick inside a regex, a `${…}` interpolation holding a real import — each of these makes a text pattern lose or invent an edge, and a lost edge reports nothing. The reader is the extractor; text is consulted only for line numbers.
- **The reader throws on code it cannot parse, and nothing catches it**, so one bad file aborts the whole graph rather than losing its own edges. This is why there is one reader *per syntax family* (a generic arrow in a `.ts` file reads as an unclosed JSX tag under the `tsx` loader), why a shebang is blanked before scanning, and why the type-reveal rewrite is as narrow as it is.
- **Bun reports imports the file does not contain.** Under a JSX loader, `scanImports()` returns runtime imports Bun injected, tagged `require-call` — the same kind as a real `require()`. They are filtered against `source.jsxImportSource`, keeping as many as the source backs with a literal `require(`.
- **Asset specifiers are dropped before classifying.** `../styles.css?url` resolves inside the source root and is not a module edge; left in, it surfaces as a boundary crossing with a filename where a boundary name should be.
- **Files sitting directly in the source root share ONE boundary.** Naming each its own makes `./env.client` from `client.tsx` read as a crossing, which is the first false positive this substrate produces if the general case handles them.
- **Both scans are kept.** `scanImports()` has literal `require()`, `scan().imports` has `require.resolve()`. Taking one loses a whole class of edge silently.

## Adapt

Everything lives in `config.source`, shared with every structural check:

- **`roots`** and **`aliasPrefix`** — where source lives and how it is addressed.
- **`subdividedDirs`** — top-level directories whose *children* are boundaries rather than being one themselves. Not always `features` and `domains`: a source root that subdivides `packages/` or `modules/` names those instead, and every consumer follows.
- **`layerOrder`** — intra-feature layers, highest to lowest. A project inserting a layer adds it here in position and `placement/layer-direction` follows without further edits. That single point of change is most of the argument for building the graph once.
- **`exclude`**, **`assetExtensions`**, **`jsxImportSource`** — what is not read, what is not an edge, and which package's injected JSX entries to filter.

## Example output

The substrate reports nothing; its consumers do.

```
FAIL [boundary/cross-boundary-alias] src/features/alpha/ui/panel.tsx:4
  "../../beta/service" leaves features/alpha and lands in features/beta.
  Write it as "@/features/beta" instead. Every other boundary rule matches on the
  aliased path, so the relative spelling of a cross-boundary import is a bypass that
  no rule sees. Relative imports stay correct inside one boundary — they cross nothing.

FAIL [placement/layer-direction] src/features/alpha/repo/nested/deep.ts:2
  repo imports from service. Direction is ui -> controllers -> service -> repo, and
  repo is the floor. Move what both layers need down here, or out to a domain.
```

## Fixtures

The substrate has no fixtures of its own — it is proved through its consumers, and `boundary/cross-boundary-alias` carries the extraction cases because every one of them shows up as a lost or invented crossing. Its nine adversarial fixtures are the extractor's test suite: a crossing between a backtick in a quoted string and the next real template, one after a regex literal containing a backtick, one inside a `${…}` interpolation, a code sample in a template literal that must stay **silent**, wrapped `import` / `require` / `from` / `export … from` spellings, a generic arrow in a plain `.ts` file, a shebang, and a specifier written with a `\u` escape.

Each of those needs a **real violation** inside the affected span. Written with a legal import instead, the edge is lost just the same and the suite stays green.
