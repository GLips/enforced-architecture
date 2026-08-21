---
name: enforced-architecture
description: >
  Generate a mechanically enforced architecture plan for a TypeScript codebase. Use when establishing or redesigning the architecture of any TypeScript project with machine-checkable import boundary enforcement. Produces a plan document: audit, target architecture, oxlint rule + structural-check enforcement rules, and a phased implementation plan. Designed for codebases where AI agents are the primary code writers.
disable-model-invocation: true
---

# Enforced Architecture

Generate a mechanically enforced architecture plan for a TypeScript codebase. The output is a plan
document that agents execute in later sessions.

## Stack Assumptions

The skill assumes Bun, TanStack Start, oxlint, Drizzle, Postgres, React, Zod and lefthook. Examples
and rule templates name these packages directly. On a different stack the invariants still hold —
translate the patterns to that framework.

## Reference Material

Read these references before and during the process.

| Reference | Read when | Purpose |
|---|---|---|
| [architecture-principles.md](references/architecture-principles.md) | Before starting | The invariants, what has a rule behind it, and what does not |
| [directory-model.md](references/directory-model.md) | Phase 2 (target architecture) | Directory templates, the configurable choices, the layer hierarchy |
| [feature-patterns.md](references/feature-patterns.md) | Phase 2 (feature design) | Feature scaling tiers, layer occupancy, the two barrels |
| [server-client-boundaries.md](references/server-client-boundaries.md) | Phase 2 (bundle splitting) | TanStack Start naming, `createServerFn` patterns, import protection config |
| [enforcement-implementation.md](references/enforcement-implementation.md) | Phase 3–4 (rules and wiring) | Rule design, the two tiers, oxlint config, lefthook, structural orchestration |
| [documentation-model.md](references/documentation-model.md) | Phase 4 (documentation) | What to write in CLAUDE.md and `docs/architecture/`, and the word budgets |
| [migration-patterns.md](references/migration-patterns.md) | Phase 4 (migration) | Which violations to clear in which order, and when to wire the gate |
| [lint/overview.md](references/lint/overview.md) | Phase 3–4 (rule catalog) | The catalog map: what each tag governs, and which part of a tree owns each rule's subject |

**The import table is not a document.** Which source may import which target is
[lint/policy/import-policy.ts](references/lint/policy/import-policy.ts), and that table is the only
statement of it. Each denial prints the reasoning for the position it denied, in the project's own
directory names. Read the table when you need a cell. Do not render a copy into the plan.

The catalog is split by **tier** first and **tag** second: `lint/oxlint/` is the per-file tier,
`lint/structural/` the whole-tree tier, `lint/policy/` the runtime-neutral tables both read. It is
three levels deep. [lint/overview.md](references/lint/overview.md) maps the tags, each
`lint/<tier>/<tag>/overview.md` holds one tier's half of one tag, and each rule's own header states
what it buys and where its blind spots are.

**No rule file has an adaptation section, because no rule is adapted in its own file.** An oxlint
rule reads its whole layout from `lint/policy/declared-trees.ts`. A structural check takes its
configuration as a typed key in `lint/structural/config.ts`, and only eight of the sixteen checks
have one. Those two files are the adaptation surface, and there is no third.

**This reference set is too large for one context.** When you implement from scratch, dispatch a
subagent for each tag directory. Have it return adapted rules, not its reading.

## Process

Work through the phases in order. Each phase has a definition of done. Do not advance until it is
met.

### Phase 1: Audit the current codebase

Walk the whole codebase. Map what exists, and name specific files and directories.

1. **Directory structure.** How is the code organized now? Which patterns are already there, even
   informal ones?
2. **Technology stack.** Framework, ORM, auth library, bundler, linter. Read `package.json` and the
   config files.
3. **Packages.** In a monorepo, list every package, and say which ones hold application code. Phase 3
   declares a tree for each. A package left off that list is governed by almost nothing.
4. **Natural domains.** What are the business areas? Which code is pure computation, and which code
   talks to the outside?
5. **Import graph.** Trace imports across the key files. Where are the worst dependency chains? Are
   there cycles? Does UI import the database?
6. **Cross-cutting concerns.** Where do database access, auth, telemetry and external SDK clients
   live? Does each one have a defined entry point?

**Done when:** you can describe the structure with specific file paths, and you have listed every
structural violation you found.

**Greenfield fast path.** If the audit finds 75 or fewer production source files — files under the
source root, and not config, generated code, tests or static assets — do Phases 1 and 2 in one pass:
record the stack and the entry points, propose the target architecture, and continue. In Phase 4, use
a sequence of two or three steps instead of the full migration. The rules catch what you miss.

### Phase 2: Propose target architecture

Read [architecture-principles.md](references/architecture-principles.md) for the invariants and
[directory-model.md](references/directory-model.md) for the structure templates.

#### Surface the configurable choices

Present each choice to the user with a recommendation drawn from the audit. Surface all of them: the
user may hold context that changes the answer. The full descriptions are in
[directory-model.md](references/directory-model.md).

1. **Domains layer** — a separate `domains/` for pure business logic, or logic inside features?
2. **Intra-feature layering** — the `ui/ → controllers/ → service/ → repo/` structure, or flat
   features with `controllers/` only?
3. **Env split** — `env.server.ts` plus `env.client.ts`, or one `env.ts`?
4. **Error architecture** — one error class at the server boundary, or typed errors for each layer?
5. **Documentation depth** — CLAUDE.md alone, or CLAUDE.md plus `docs/architecture/`? See
   [documentation-model.md](references/documentation-model.md).

Each choice moves a name or a number. None of them switches a rule off.

#### Propose the architecture

1. **Target directory tree** — complete and annotated. This is the most important artifact, because
   agents navigate by structure.
2. **Responsibility split** — "to work on X, look in Y" for each kind of work.
3. **Dependency graph** — ASCII, showing the allowed directions. State each edge.
4. **Public API conventions** — the two barrels, `index.ts` and `index.server.ts`, and what each one
   holds. See [feature-patterns.md](references/feature-patterns.md#public-api-barrels).
5. **Feature directory patterns, server and client naming, error architecture** — the scaling tiers
   from [feature-patterns.md](references/feature-patterns.md), the TanStack Start conventions from
   [server-client-boundaries.md](references/server-client-boundaries.md), and the error choice above.
6. **SDK containment** — classify each third-party SDK as wrapped or unconstrained. A wrapped SDK
   gets a row in `lint/policy/package-owners.ts` naming the module that owns it. A package with no
   row is unconstrained, and no rule holds it to a layer.
7. **Test placement** — beside the code. Tests are exempt from boundary enforcement.
8. **Design-system boundary** — where the primitives layer lives, and which module holds the tokens.
   Both are vocabulary in `declared-trees.ts`: `sharedUiSubdir` and `themeModuleName`. Three `style/`
   rules exempt the primitives layer, because a primitive is the one place that sets a raw value, and
   two exempt the token module. What each structural `style/` check takes as config, and which takes
   none, is [structural/style/overview.md](references/lint/structural/style/overview.md). If there is
   no design system yet, say so: the tag becomes a later phase.

**Calibration.** For each proposed layer, directory or abstraction, ask whether it earns its place. A
service layer that forwards calls does not.

**Navigability.** Structure is how agents find code. Names are how they *search* it. Name directories
and public exports after the domain concepts they hold, specifically enough to work as an address:
`createStripeClient`, not `create`. The `naming/` tag enforces only the mechanical part.

**Done when:** an agent that reads the target structure alone can answer "where does this code live?"
for any kind of work.

### Phase 3: Design enforcement rules

Read [lint/overview.md](references/lint/overview.md) for the tag map, and *Rule Design Principles* in
[enforcement-implementation.md](references/enforcement-implementation.md) for what a rule must be.

**The catalog comes in whole.** This phase decides where each rule points and what its numbers are.
It never decides which rules run. `lint/oxlint/plugin.ts` and
[references/setup/oxlintrc.json](references/setup/oxlintrc.json) are one list in two files, and they
are copied together. In the config that list spans two blocks: 48 tree-scoped rules in
`overrides[0].rules` under the source-root globs, and `arch/no-module-mocking` in the top-level
`rules` block. Check the plugin against both, or 48 rules read as missing. A config key naming a rule
the plugin does not export is fatal, so registering a subset and then copying the shipped config
takes the whole lint run down.

**Process:**

1. Read `lint/<tier>/<tag>/overview.md` for each tag. The table has one column per tier, so it also
   says which halves of a tag exist.
2. Read each rule's header for what it buys and what it deliberately does not cover. Do not look
   for an adaptation section in it: an oxlint rule has nothing to set, because it reads the layout
   from `lint/policy/declared-trees.ts`.
3. Set the two files that do take values. `lint/policy/declared-trees.ts` holds each tree's
   vocabulary — directory names and the alias prefix. `lint/structural/config.ts` declares the eight
   check configs, and the project's `arch.config.ts` overrides what differs: thresholds, explicit
   rows, a manifest path, one filename. Never a *pattern*. No rule takes a regex or a glob, and no
   rule's scope is repointed by hand.
4. A rule's mechanism is its tier, and its tier is its directory. `lint/oxlint/` is per-file and runs
   in the editor; `lint/structural/` is cross-file and runs at pre-commit. Carry the path into the
   plan and the mechanism comes with it.
5. Add project-specific rules the catalog does not cover.

Keep the plan's rule section lean: one table, not a copy of the templates. The templates already hold
the mechanism, the severity, the messages and the implementation. Each row is a rule id (`tag/name`)
and what this project changed for it — a vocabulary name, a threshold, an explicit row, a declared
path, or "Standard". Never a pattern.

A rule that looks unnecessary is usually a rule whose subject this tree does not have yet. It is
silent until the tree grows one, which is why you take it now. When a rule's subject genuinely lives
in a package this project does not own, say *where it lives* instead of leaving the rule out.

**Every governed tree goes in `lint/policy/declared-trees.ts`.** A tree left off it is enforced by
almost nothing: every tree-scoped rule in both tiers is silent there, with no finding and no
diagnostic. Three checks are not tree-scoped and do run over an undeclared package —
`testing/no-module-mocking`, which is global because its subject is a test file, and the two
project-scoped structural checks. `health/file-size` walks its own configured roots.
`health/doc-budgets` walks nothing: it counts exactly the paths its manifest names.
Architecturally an undeclared package is ungoverned. Record the list in the plan, and record what is
deliberately outside it, because an undeclared package reads exactly like a clean one.

Note also that nothing in either tier reports an import from one declared tree into another.

**Done when:** every catalog rule is registered and switched on, every declared tree is listed with
its vocabulary, and every rule whose vocabulary or thresholds moved records what moved.

### Phase 4: Plan implementation

Read [enforcement-implementation.md](references/enforcement-implementation.md) for the tooling, and
[migration-patterns.md](references/migration-patterns.md) for the sequence.

**The project mirrors the catalog.** One `lint/` at the repo root holds the same three directories,
so a rule's tier is as visible in the project as it is here, and copying a rule is copying a path.

```
lint/
  policy/       declared-trees.ts layout.ts import-policy.ts package-owners.ts — the tree list and
                the tables both tiers read
  oxlint/       plugin.ts, lib/, <tag>/ — rules and their specs
  structural/   config.ts check-substrate.ts import-graph.ts registry.ts run-structural-checks.ts,
                arch.config.ts, <tag>/ — checks
```

In a monorepo that `lint/` still sits once at the repo root, and `declared-trees.ts` holds one entry
for each governed package. Two packages that spell their directories differently get one entry each,
with their own vocabulary. A single-package repo is the same shape with one entry.

**Greenfield sequence:**

1. **`lint/policy/`** — copied whole, then adapted. `declared-trees.ts` is where this project's
   source roots are declared, each with the vocabulary its directories are spelled in, and it is the
   only file under `lint/policy/` that needs an edit. Both tiers read it, so it lands before either.
   The oxlint specs are adapted in step 2, and each spec spells its own fixture filenames by hand —
   deliberately, so a wrong vocabulary cannot produce a matching wrong filename and pass.
2. **`lint/oxlint/`** — the rules and their specs under `<tag>/`, plus `lib/`, all registered in
   `lint/oxlint/plugin.ts`. Then `.oxlintrc.json` at the root, from
   [references/setup/oxlintrc.json](references/setup/oxlintrc.json). That file is the whole manifest,
   not a sample to extend: every registered rule is already named there at a deliberate severity. Its
   `overrides` block scopes the tree-scoped `arch/` rules to the declared roots — one `<root>/**`
   glob per root, or a nested `.oxlintrc.json` per workspace that `extends` it — and those globs must
   match `declared-trees.ts`. `arch/no-module-mocking` stays in the global `rules` block, because
   scoping it to a tree would switch it off for every test outside one. The dev dependencies are
   unversioned, so the project gets current releases:
   `bun add -d oxlint oxlint-tsgolint @oxlint/plugins eslint-plugin-sonarjs jscpd`
3. **`lint/structural/`** — the substrate (`config.ts`, `check-substrate.ts`, `import-graph.ts`,
   `module-resolution.ts`, `registry.ts`, `run-structural-checks.ts`) and every check, all taken
   unmodified, plus `bun add -d oxc-resolver`. Write `arch.config.ts` on top of
   `defaultCheckConfigs`.
4. **One tsconfig per tier** — [references/setup/oxlint.tsconfig.json](references/setup/oxlint.tsconfig.json)
   and [references/setup/structural.tsconfig.json](references/setup/structural.tsconfig.json) — and
   add both to the typecheck script by path. They are separate programs because the tiers run under
   different runtimes.
5. **Package.json scripts** — `check:arch`, and `duplication` for the CI-only jscpd pass — plus
   `.jscpd.json` from [references/setup/jscpd.json](references/setup/jscpd.json).
6. **`lefthook.yml`** from [references/setup/lefthook.yml](references/setup/lefthook.yml).
7. **Framework import protection** in `vite.config.ts`.
8. **The directory tree**, with empty barrels.
9. **Documentation** per [documentation-model.md](references/documentation-model.md): the CLAUDE.md
   rules section, and the `docs/architecture/` files if that choice was made. Then write
   `docs/doc-budgets.manifest.json` from
   [references/setup/doc-budgets.manifest.json](references/setup/doc-budgets.manifest.json).
   Ceilings come from what the generated docs weigh, so this step follows them.
10. **Verify.** Run `bun run check:arch`, and read every finding before you run `bun run dev`. Write
    the script so each check runs even when an earlier one fails: an `&&` chain stops at the first
    failure, and the checks it skipped report clean by never running.

**Migration.** Decompose it per [migration-patterns.md](references/migration-patterns.md). A
migration sequences which violations you clear, not which rules run, and the gate is wired last.

**The two tiers adopt differently, and treating them alike is the mistake to avoid.** Structural
checks are copied wholesale and configured on top of `defaultCheckConfigs`; reimplementing one from
its doc is how a check ends up matching less than its doc promises. oxlint rules are copied wholesale
and not configured at all. Two of them hold a hand-written list, and neither is a scope knob:
`boundary/client-server-infra`'s two client-safe modules, and `placement/deprecated-paths`'s paths
this project has moved away from, which is that rule's subject. Parallelize the copying with one
subagent per tag directory, and have them register in `lint/oxlint/plugin.ts` in one later pass,
rather than editing that file at the same time.

**Every rule ships with a permanent spec, and one case in it is adversarial.** A rule fails silently:
when it stops matching it goes green, not red. The adversarial case — the violation written the way
your rule *misses* — is the one that decides whether the rule works.

**Done when:** the plan has numbered phases with file-level changes, the rules that activate in each
phase, and a verification step. Every rule has its spec, and the suite runs in the gate.

### Phase 5: Assemble the plan document

Write the plan to `docs/plans/<date>-enforced-architecture-plan.md`, for example
`docs/plans/2026-02-19-enforced-architecture-plan.md`.

1. **Decision Summary** — the architectural decisions and the reasoning. Which configurable choices
   were made, and why.
2. **Target Architecture** — the annotated tree, the responsibility table, the dependency graph, the
   barrel conventions, the server and client naming.
3. **Declared Trees** — each governed source root with its vocabulary, and each package deliberately
   left outside, with the sentence that says an undeclared package is ungoverned.
4. **Rule Adaptations** — one table of rule id plus what this project moved for it. See Phase 3.
   There is no excluded-rules table: the catalog comes in whole, so a rule that reports nothing is a
   rule whose subject this tree does not have yet, and the only thing that makes a rule silent by
   decision is a tree left undeclared.
5. **SDK Containment** — which packages are wrapped and which are left unconstrained.
6. **Documentation Spec** — which CLAUDE.md sections to generate, which `docs/architecture/` files to
   create, and the word ceilings.
7. **Implementation Checklist** (greenfield) or **Migration Plan** (existing) — from Phase 4.
8. **Current Violations** (migration only) — from the audit, with file paths and fixes, ordered as
   [migration-patterns.md](references/migration-patterns.md) orders them.

**The plan lives in the project repo, and agents read it in later sessions.** Include this paragraph
for rule implementation:

> Rule templates are in the `enforced-architecture` skill
> (`~/.claude/skills/enforced-architecture/references/lint/`), split by tier: `lint/policy/`,
> `lint/oxlint/<tag>/` and `lint/structural/<tag>/`. Each rule below names its template by that path,
> so the path names the tier. The project mirrors the tree — copy into its own `lint/`.
>
> **`lint/policy/` first, before either tier.** Copy it whole, then declare this project's source
> roots in `lint/policy/declared-trees.ts`, each with the vocabulary its directories are spelled in.
> Both tiers import it, and an oxlint rule has no adaptation of its own — its layout comes from
> that file. A tree left off that list is silent for every tree-scoped rule
> in both tiers, with nothing saying so; only `testing/no-module-mocking`, `health/file-size` and
> `health/doc-budgets` still run over it.
>
> **oxlint rules:** copy the template and its spec into `lint/oxlint/<tag>/`, register it in
> `lint/oxlint/plugin.ts`, and switch it on in `.oxlintrc.json`. Do not repoint one at a path: tree
> scoping comes from `declared-trees.ts` through the `.oxlintrc.json` overrides.
>
> **Structural checks:** copy the module and the `lint/structural/` substrate unmodified, register it
> in `lint/structural/registry.ts`, and put every project-specific value in
> `lint/structural/arch.config.ts`. The keys and their defaults are in
> `lint/structural/config.ts`, typed per check; eight of the sixteen checks have one. Do not
> reimplement a check from its doc.

## Tone

Be opinionated, and calibrate honestly. Prefer the stricter boundary, but propose only the structure
the invariants need. Define structural boundaries, not feature behavior.
