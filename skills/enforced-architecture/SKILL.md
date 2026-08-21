---
name: enforced-architecture
description: >
  Generate a mechanically enforced architecture plan for a TypeScript codebase. Use when establishing or redesigning the architecture of any TypeScript project with machine-checkable import boundary enforcement. Produces a plan document: audit, target architecture, oxlint rule + structural-check enforcement rules, and a phased implementation plan. Designed for codebases where AI agents are the primary code writers.
disable-model-invocation: true
---

# Enforced Architecture

Generate a mechanically enforced architecture plan for a TypeScript codebase. The output is a plan document that can be executed by agents in future sessions.

## Stack Assumptions

This skill assumes Bun, TanStack Start, oxlint, Drizzle, Postgres, React, Zod, and lefthook. Examples and rule templates use these packages directly. If your project uses a different stack, the architectural principles still apply — translate the patterns to your framework and tooling.

## Reference Material

Read these references before and during the process:

| Reference | Read when | Purpose |
|---|---|---|
| [architecture-principles.md](references/architecture-principles.md) | Before starting | Core philosophy, layer model, dependency direction |
| [directory-model.md](references/directory-model.md) | Phase 2 (target architecture) | Directory templates, responsibility split, configurable choices |
| [import-boundaries.md](references/import-boundaries.md) | Phase 2 (boundaries) | Import boundary matrix, cross-boundary rules, public API conventions, SDK containment |
| [feature-patterns.md](references/feature-patterns.md) | Phase 2 (feature design) | Feature scaling templates, layer occupancy, controllers/service/repo/ui |
| [server-client-boundaries.md](references/server-client-boundaries.md) | Phase 2 (bundle splitting) | TanStack Start server/client conventions, createServerFn patterns, importProtection config |
| [enforcement-implementation.md](references/enforcement-implementation.md) | Phase 3–4 (rules and wiring) | Rule design principles, the three tiers, oxlint config, lefthook, structural orchestration |
| [documentation-model.md](references/documentation-model.md) | Phase 4 (documentation) | What to document in CLAUDE.md and docs/architecture/, content checklists |
| [migration-patterns.md](references/migration-patterns.md) | Phase 4 (migration) | Atomic phase decomposition, sequencing, verification |
| [lint/overview.md](references/lint/overview.md) | Phase 3–4 (rule catalog) | The catalog map: what each tag governs, and what part of the tree owns each rule's subject |

The catalog is split by **tier** first and **tag** second — `lint/oxlint/` is the per-file tier, `lint/structural/` the whole-tree tier, `lint/policy/` the runtime-neutral tables both read. It is three layers deep: [lint/overview.md](references/lint/overview.md) maps the tags, each `lint/<tier>/<tag>/overview.md` holds that tier's half of one tag, each rule template carries its own *Adapt* section.

**This reference set is too heavy for one context.** When implementing from scratch, dispatch a subagent per tag directory and have it return adapted rules rather than its reading.

## Process

Work through these phases in order. Each phase has a definition of done — do not advance until it is met.

### Phase 1: Audit the current codebase

Walk the entire codebase. Map what actually exists — reference specific files and directories, not hypotheticals.

1. **Directory structure and layout.** What is the current organization? Are there existing patterns (even informal ones)?
2. **Technology stack.** Framework, ORM, auth library, bundler, linter. Read `package.json` and config files.
3. **Natural domains.** What are the business areas? What is pure computation vs. side-effectful integration?
4. **Import graph.** Trace imports across key files. Where are the messiest dependency chains? Are there circular dependencies? Does UI import DB directly?
5. **Cross-cutting concerns.** Where do DB access, auth, telemetry, and external API clients live? Are they imported ad-hoc or through defined entry points?

**Done when:** You can describe the current structure with specific file paths. You have identified every structural violation you can find.

**Greenfield fast path:** If the audit reveals ~75 or fewer production source files (files in `src/`, excluding config, generated files, tests, and static assets), compress Phases 1–2 into a single pass: document the stack and entry points, propose the target architecture, and move on. In Phase 4, use a 2–3 step implementation sequence rather than the full atomic migration phases — the enforcement rules will catch anything you miss, so the detailed phased approach isn't necessary at this scale.

### Phase 2: Propose target architecture

Read [architecture-principles.md](references/architecture-principles.md) for philosophy, [directory-model.md](references/directory-model.md) for structure templates, and [import-boundaries.md](references/import-boundaries.md) for the boundary matrix.

#### Surface configurable choices

Present these choices to the user with a recommendation based on audit findings. Always surface all choices — the user may have context that changes the answer.

Read the full choice descriptions in [directory-model.md](references/directory-model.md). Summary:

1. **Domains layer** — Separate `domains/` for pure business logic, or keep logic in features?
2. **Intra-feature layering** — Enforced `ui/ → controllers/ → service/ → repo/` internal structure, or flat features with just `controllers/`?
3. **Env split strategy** — Separate `env.server.ts` + `env.client.ts`, or single `env.ts`?
4. **Error architecture** — Single error class at the server boundary, or per-layer typed errors?
5. **Documentation depth** — CLAUDE.md only, or CLAUDE.md + `docs/architecture/` reference files? See [documentation-model.md](references/documentation-model.md).

#### Propose the architecture

Using the chosen configuration, propose:

1. **Target directory structure** — Complete annotated tree. This is the most important artifact — agents navigate by structure.
2. **Responsibility split** — "If working on X, look in Y, don't reach into Z" for every type of work.
3. **Import boundary matrix** — Every cell explicitly decided. Use the matrix format from [import-boundaries.md](references/import-boundaries.md).
4. **Dependency graph** — ASCII showing allowed import directions. Every edge explicit.
5. **Public API conventions** — Two-barrel pattern (`index.ts` + `index.server.ts`). Convention table from [import-boundaries.md](references/import-boundaries.md).
6. **Feature directory patterns** — Scaling templates from [feature-patterns.md](references/feature-patterns.md).
7. **Server/client file naming** — TanStack Start conventions from [server-client-boundaries.md](references/server-client-boundaries.md).
8. **Error architecture** — Based on chosen configuration.
9. **SDK containment** — Classify every third-party SDK as wrapped or layer-restricted.
10. **Test placement** — Co-located. Tests excluded from boundary enforcement.
11. **Design-system boundary** — Where the primitives layer lives, and which module owns each closed scale (color, type, spacing, radius, elevation). Every `style/` rule keys off these two: the primitives path is what they exempt, the token source is what `style/token-equality` imports. If there is no design system yet, say so — the tag becomes a later phase rather than a rule set to adapt now.

**Calibration:** For every proposed layer, directory, or abstraction, ask: does this earn its place? If a service layer would just forward calls, don't propose it.

**Navigability:** Structure is how agents find code; names are how they *search* it. Name directories and public exports after the domain concepts they contain, specifically enough to work as an address (`createStripeClient`, not `create`). This is a judgment call carried through the whole proposal — the `naming/` tag enforces only the mechanical piece.

**Done when:** An agent reading only the target structure section could answer "where does this code live?" for any type of work.

### Phase 3: Design enforcement rules

Read [lint/overview.md](references/lint/overview.md) for the tag map, and *Rule Design Principles* in [enforcement-implementation.md](references/enforcement-implementation.md) for what a rule has to be.

**The catalog comes in whole.** What this phase decides is where each rule points and what its numbers are — never which rules run. `lint/oxlint/plugin.ts` and the `rules` block of [references/setup/oxlintrc.json](references/setup/oxlintrc.json) are one list wearing two hats, and they are copied together: a config key naming a rule the plugin does not export is fatal, so registering a subset and then copying the shipped config takes the entire lint run down with it.

**Process:**
1. Read `lint/<tier>/<tag>/overview.md` for every tag. The table has one column per tier, so it also tells you which halves of a tag exist.
2. Read each rule's template in `lint/<tier>/<tag>/`. Its *Adapt* section names what this project has to set — a template whose *Adapt* section says **nothing here**, which is nearly all of them, reads `lint/policy/`, and declaring the project's trees in `lint/policy/declared-trees.ts` is its whole adaptation.
3. Set what those sections name: vocabulary, thresholds, explicit rows, and the handful of validated paths the structural config declares — a manifest path, canonical project-relative roots, one filename. Never a *pattern*: no rule takes a regex or a glob, and no rule's scope is repointed by hand — tree scoping comes from `declared-trees.ts`.
4. A rule's enforcement mechanism is its tier, and the tier is its directory — `lint/oxlint/` is per-file and real-time, `lint/structural/` is cross-file and pre-commit. Carry the path into the plan and the mechanism comes with it.
5. Add project-specific rules not covered by the catalog.

Keep the plan's rule section lean — one table, not a copy of template content. The templates already carry mechanism, blocking status, messages, and implementation.

- **Adaptation** — rule id (`tag/name`) and what this project changed for it: a vocabulary name, a threshold, an explicit row, a declared path the *Adapt* section names, or "Standard". Never a pattern, and never a hand-repointed scope.

A rule that looks unnecessary is usually a rule whose subject this tree does not have yet — it is silent until the tree grows one, which is the point of taking it now. When a rule's subject genuinely lives somewhere this project does not own, the answer is to say *where it lives* rather than to leave the rule out.

**Every governed tree goes in `lint/policy/declared-trees.ts`, and a tree left off it is enforced by almost nothing** — every tree-scoped rule in both tiers is silent there: no findings, no diagnostic. Three checks are not tree-scoped and do still run over an undeclared package: `testing/no-module-mocking` (its subject is a test file, so it is enabled globally) and the two project-scoped structural checks, `health/file-size` and `health/doc-budgets`, which walk their own configured roots. Architecturally, an undeclared package is ungoverned. Record the list in the plan, and record what is deliberately outside it, because an undeclared package reads exactly like a clean one. Note too that nothing in either tier reports an import from one declared tree into another.

**Done when:** Every catalog rule is registered and switched on, and every one whose vocabulary or thresholds this project moved records what it moved.

### Phase 4: Plan implementation

Read [enforcement-implementation.md](references/enforcement-implementation.md) for tooling setup. Read [migration-patterns.md](references/migration-patterns.md) for migration sequencing.

**The project mirrors the catalog.** One `lint/` at the repo root holding the same three directories, so a rule's tier is as visible in the project as it is in the catalog and copying one is copying a path:

```
lint/
  policy/       declared-trees.ts layout.ts import-policy.ts package-owners.ts — the tree list and
                the tables both tiers read
  oxlint/       plugin.ts, lib/, <tag>/ — rules and their specs
  structural/   config.ts check-substrate.ts import-graph.ts registry.ts run-structural-checks.ts,
                arch.config.ts, <tag>/ — checks
```

**Greenfield sequence:**
1. `lint/policy/` — copied whole, then adapted: `declared-trees.ts` is where this project's source roots are declared, each with the vocabulary its directories are spelled in, and it is the only file under `lint/policy/` that needs an edit. Both tiers read it, so it lands before either. It is not the only edit in the copy: the oxlint rules and their specs are adapted in step 2, and each spec spells its own fixture filenames by hand — deliberately, so a wrong vocabulary cannot produce a matching wrong filename and pass
2. `lint/oxlint/` — the rules and their specs under `<tag>/`, plus `lib/`, all registered in `lint/oxlint/plugin.ts`. Then `.oxlintrc.json` at the root from [references/setup/oxlintrc.json](references/setup/oxlintrc.json) — that file is the whole manifest, not a sample to extend: every registered rule is already named there at a deliberate severity, so copying it is the last decision about which rules run. Its `overrides` block scopes every `arch/` rule to the declared roots — one `<root>/**` glob per root, or a nested `.oxlintrc.json` per workspace that `extends` it — and the two lists have to match. The dev dependencies are unversioned so the project gets current releases: `bun add -d oxlint oxlint-tsgolint eslint-plugin-sonarjs jscpd`
3. `lint/structural/` — the substrate (`config.ts`, `check-substrate.ts`, `import-graph.ts`, `registry.ts`, `run-structural-checks.ts`) and every check, all taken unmodified. Write `arch.config.ts` on top of `defaultCheckConfigs`
4. One tsconfig per tier — [references/setup/oxlint.tsconfig.json](references/setup/oxlint.tsconfig.json) and [references/setup/structural.tsconfig.json](references/setup/structural.tsconfig.json) — and add both to the typecheck script by path. They are separate programs because the tiers run under different runtimes
5. Package.json scripts (`check:arch`, and `duplication` for the CI-only jscpd pass), plus `.jscpd.json` from [references/setup/jscpd.json](references/setup/jscpd.json)
6. `lefthook.yml` from [references/setup/lefthook.yml](references/setup/lefthook.yml)
7. Framework import protection (vite.config.ts)
8. Directory structure with empty barrels
9. Generate documentation per [documentation-model.md](references/documentation-model.md) — CLAUDE.md rules section, and docs/architecture/ files if chosen. Then write `docs/doc-budgets.manifest.json` for `health/doc-budgets` from [references/setup/doc-budgets.manifest.json](references/setup/doc-budgets.manifest.json) — ceilings come from what the generated docs actually weigh, so this step follows them
10. Verify: `bun run check:arch && bun run dev`

**Migration:** Decompose into atomic phases per [migration-patterns.md](references/migration-patterns.md). Each phase produces a clean repo.

**The two tiers adopt differently, and treating them alike is the mistake to avoid.** Structural checks are copied wholesale and configured on top of `defaultCheckConfigs` — reimplementing one from its doc is how a check ends up silently matching less than its doc promises. oxlint rules are copied wholesale too — none holds a path pattern — and the few that name constants name enumerable vocabulary. Parallelize the copying with one subagent per tag directory, and have them register in `lint/oxlint/plugin.ts` in one pass afterwards rather than editing that file concurrently. Procedures for both are in [enforcement-implementation.md](references/enforcement-implementation.md).

**Every rule ships with a permanent spec, and one of its cases is adversarial.** A rule's failure mode is silent: when it stops matching it goes green, not red. The adversarial case — the violation written the way your rule *misses* — is the one that decides whether the rule works.

**Done when:** Numbered phases with specific file-level changes, the rules that activate in each phase, and a verification step. Every rule has its spec, and the suite runs in the gate.

### Phase 5: Assemble the plan document

Write the plan to `docs/plans/<date>-enforced-architecture-plan.md` (e.g., `docs/plans/2026-02-19-enforced-architecture-plan.md`).

Combine all phases into a single document:

1. **Decision Summary** — Core architectural decisions and rationale. Which configurable choices were made and why (including documentation depth).
2. **Target Architecture** — Directory layout (annotated tree), responsibility split table, dependency graph, public API conventions, server/client file naming.
3. **Import Boundary Matrix** — Top-level matrix, within-feature boundaries, cross-feature rules, SDK containment configuration.
4. **Rule Adaptations** — The declared trees from `lint/policy/declared-trees.ts`, what is deliberately outside them, and one table of rule id + what this project moved for it. See Phase 3 for the format. There is no excluded-rules table: the catalog comes in whole, so a rule that reports nothing is a rule whose subject this tree does not have yet, and the only thing that makes a rule silent by decision is a tree left undeclared.
5. **Documentation Spec** — Which CLAUDE.md sections to generate and which docs/architecture/ files to create. Content checklist per [documentation-model.md](references/documentation-model.md).
6. **Implementation Checklist** (greenfield) or **Migration Plan** (existing) — From Phase 4.
7. **Current Violations** (migration only) — Prioritized from the audit, with specific file paths and fix descriptions.

**Important:** The plan document lives in the project repo and will be read by agents in future sessions. Include this reference for rule implementation:

> Rule templates are in the `enforced-architecture` skill (`~/.claude/skills/enforced-architecture/references/lint/`), split by tier: `lint/policy/`, `lint/oxlint/<tag>/` and `lint/structural/<tag>/`. Each rule in this plan references its template by that path, so the path names the tier. The project mirrors the tree — copy into its own `lint/`. **`lint/policy/` first, before either tier:** copy it whole, then declare this project's source roots in `lint/policy/declared-trees.ts`, each with the vocabulary its directories are spelled in. Both tiers import it, and a rule whose *Adapt* section says "nothing here" — which is most of them — is a rule whose adaptation happens there. A tree that is not on that list is silent for every tree-scoped rule in both tiers, with nothing saying so; only `testing/no-module-mocking`, `health/file-size` and `health/doc-budgets` still run over it. **oxlint rules:** copy the template and its spec into `lint/oxlint/<tag>/`, registered in `lint/oxlint/plugin.ts` and switched on in `.oxlintrc.json`. Do not repoint one at a path — none of them holds a path pattern, and the tree scoping comes from `declared-trees.ts` through the `.oxlintrc.json` overrides. **Structural checks:** copy the module and the `lint/structural/` substrate unmodified, register it in `lint/structural/registry.ts`, and put every project-specific value in `lint/structural/arch.config.ts` — the rule's *Adapt* section names the keys. Do not reimplement one from its doc.

## Tone

Be opinionated and calibrate honestly: err toward stricter boundaries, but propose only the structure the dependency invariants actually need. Define structural boundaries, not feature-specific behavior.
