# policy — the tables both tiers read

Runtime-neutral. The contract binds what SHIPS into both runtimes — a `<name>.test.ts` beside a table ships into neither and is outside it, which is why the spec here imports `node:test`. Every other module may import nothing but other modules here, and may reference:

- **no Node APIs** — no `node:fs`, no `node:path`, nothing that assumes a filesystem
- **no Bun APIs** — no `Bun.Glob`, no `Bun.file`
- **no oxlint or ESTree types** — no `definePlugin`, no AST node types, no `Rule` context
- **no import from `../oxlint/` or `../structural/`** — the dependency runs the other way

What is left is data and pure functions over it: tables, vocabularies, and evaluators that take a
string and return a verdict.

## Why the constraint is worth the directory

Some architectural questions are asked from both tiers, and each tier sees a different half of the
evidence. Whether an import is legal is the standing example: the oxlint tier sees aliased
specifiers and bare package names in one file's source text, and the structural tier sees resolved
relative edges across the whole graph. If each tier carries its own copy of the answer, one edge
reaches two verdicts depending on how it happened to be spelled — and the disagreement is invisible,
because neither tier can see the other's table.

A rule whose question needs both tiers therefore has its *policy* here and an *adapter* on each
side. Both adapters hand the same evaluator the same source-root-relative string, so there is one
answer and one place to change it.

The neutrality is what makes that possible. A table that imports `node:path` cannot be read by a
rule running inside oxlint's plugin host; a table that imports an ESTree type cannot be read by a
Bun script walking the filesystem. The moment either happens, the shared answer stops being shared
and the directory has bought nothing.

## What lives here

| Module | What it holds | Read by |
|---|---|---|
| [layout.ts](layout.ts) | The shape of the tree: source root, alias prefix, directory names, feature layers, barrel and env module names — and the two classifiers that turn a source-root-relative path into a `SourceProfile` or a `TargetArea`. **This is the whole adaptation surface for the import policy.** | Both `import-policy` adapters, `boundary/sdk-containment`, `placement/layer-direction` |
| [import-policy.ts](import-policy.ts) | The `SourceProfile × TargetArea` table, the rationale each denial is rendered with, and `evaluateImportPolicy` | `oxlint/boundary/import-policy.ts`, `structural/boundary/import-policy.ts` |
| [package-owners.ts](package-owners.ts) | One row per contained package: which modules may import it, and why | `oxlint/boundary/sdk-containment.ts` |
| [import-policy.test.ts](import-policy.test.ts) | The engine's own specs — that each path reaches the cell its author intended, and that one edge spelled two ways reaches one verdict | The rule harness, under Node |

The table is exhaustive by type: every `SourceProfile` must name every `TargetArea`, so adding
either without deciding the new cells is a compile error rather than a silent `any`.

## There is a second path classifier, and which one to reach for

`structural/import-graph.ts` classifies a path too, into a **boundary** — `features/alpha`,
`shared`, `infrastructure` — and that is not the same answer `layout.ts` gives. Both take a
source-root-relative path and split it on segments; they deliberately disagree about one thing, and
the disagreement is the point:

| | `import-graph.ts`'s `classify` | `layout.ts`'s `classifySourcePath` |
|---|---|---|
| Answers | boundary, feature, layer | profile and **unit** |
| `shared/ui/card.ts` | boundary `shared` | unit `shared/ui` |
| Reach for it when | the question is about the coarse grouping — cycles between features, coupling counts, which feature an edge belongs to | the question is what an edge is *permitted* to do |

`graph/domain-cycles` and `graph/feature-deps` want the coarse one: a cycle between two features is
a fact about the features, and subdividing `shared` would not change it. Anything the policy touches
wants the fine one, because `shared/ui` and `shared` being one boundary and two units is exactly the
edge a boundary comparison cannot see.

A new check picks by that question, not by which import is closer to hand. `placement/layer-direction`
uses both in one function and is the seam to read first if this ever needs changing.

The spec ships beside the tables for the same reason a rule's spec ships beside the rule — a project
copying `policy/` gets the proof that it still means what it meant here. It runs under Node with the
oxlint tier (`bun run check:rules`), because a table proved in one runtime and consumed in two is a
table proved once.
