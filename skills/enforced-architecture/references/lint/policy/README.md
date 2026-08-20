# policy — the tables both tiers read

Runtime-neutral. A module here may import nothing but other modules here, and may reference:

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

Nothing yet. The first tables land with the policy engine that reads them.
