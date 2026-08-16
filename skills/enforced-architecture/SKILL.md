---
name: enforced-architecture
description: >
  Generate a mechanically enforced architecture plan for a TypeScript codebase. Use when establishing or redesigning the architecture of any TypeScript project with machine-checkable import boundary enforcement. Produces a plan document: audit, target architecture, oxlint rule + structural script enforcement rules, and a phased implementation plan. Designed for codebases where AI agents are the primary code writers.
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
| [enforcement-strategy.md](references/enforcement-strategy.md) | Phase 3 (rule design) | Two-layer enforcement (oxlint rules + scripts), three-tier pipeline, rule field template |
| [enforcement-implementation.md](references/enforcement-implementation.md) | Phase 4 (implementation) | oxlint config, lefthook, package.json scripts, structural script orchestration |
| [documentation-model.md](references/documentation-model.md) | Phase 4 (documentation) | What to document in CLAUDE.md and docs/architecture/, content checklists |
| [migration-patterns.md](references/migration-patterns.md) | Phase 4 (migration) | Atomic phase decomposition, sequencing, verification |
| [rules/overview.md](references/rules/overview.md) | Phase 3–4 (rule catalog) | The catalog map: what each tag governs, and which rules a project needs |

The catalog is three layers: [rules/overview.md](references/rules/overview.md) picks tags, each `rules/<tag>/overview.md` picks rules, each rule template carries its own *Adapt* section.

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

Read [enforcement-strategy.md](references/enforcement-strategy.md) for the two-layer model. Read [rules/overview.md](references/rules/overview.md) to choose tags.

**Process:**
1. Pick the tags this architecture needs from the hub's map and *Selecting rules* table, then read `rules/<tag>/overview.md` for each to choose rules within it.
2. For each selected rule, read its template in the appropriate `rules/<tag>/` directory.
3. Adapt each rule to the project's specific directory names, import patterns, and conventions.
4. Tag each rule with its enforcement mechanism: **oxlint rule** (per-file, real-time) or **structural script** (cross-file, pre-commit).
5. Add project-specific rules not covered by the catalog.

Keep the plan's rule section lean — two tables, not a copy of template content. The templates already carry mechanism, blocking status, messages, and implementation.

- **Included** — rule id (`tag/name`) and its adaptation: project-specific paths, package lists, thresholds, or "Standard".
- **Excluded** — every catalog rule not selected, with the reason (e.g. "No domains layer"). Say why, or the next agent re-litigates the same choice.

**Done when:** Every architectural constraint has a corresponding rule selected from the catalog (or added as project-specific). Every selected rule notes its project-specific adaptations.

### Phase 4: Plan implementation

Read [enforcement-implementation.md](references/enforcement-implementation.md) for tooling setup. Read [migration-patterns.md](references/migration-patterns.md) for migration sequencing.

**Greenfield sequence:**
1. `.oxlintrc.json` from [references/setup/oxlintrc.json](references/setup/oxlintrc.json), plus the rule modules and their specs in the `oxlint/` directory, all registered in `oxlint/plugin.ts`. Install its dev dependencies with the package manager, unversioned so the project gets current releases: `bun add -d oxlint oxlint-tsgolint eslint-plugin-sonarjs jscpd`
2. `scripts/` — copy `config.ts`, `lib.ts`, `import-graph.ts`, `run-structural-checks.ts` and `registry.ts` from the catalog, then each selected check module. Write the project's `arch.config.ts` on top of the defaults; the checks themselves are taken unmodified
3. Package.json scripts (`check:arch`, and `duplication` for the CI-only jscpd pass), plus `.jscpd.json` from [references/setup/jscpd.json](references/setup/jscpd.json)
4. `lefthook.yml` from [references/setup/lefthook.yml](references/setup/lefthook.yml)
5. Framework import protection (vite.config.ts)
6. Directory structure with empty barrels
7. Generate documentation per [documentation-model.md](references/documentation-model.md) — CLAUDE.md rules section, and docs/architecture/ files if chosen. Then, if `health/doc-budgets` was selected, write `docs/doc-budgets.manifest.json` from [references/setup/doc-budgets.manifest.json](references/setup/doc-budgets.manifest.json) — ceilings come from what the generated docs actually weigh, so this step follows them
8. Verify: `bun run check:arch && bun run dev`

**Migration:** Decompose into atomic phases per [migration-patterns.md](references/migration-patterns.md). Each phase produces a clean repo.

**The two tiers adopt differently, and treating them alike is the mistake to avoid.**

- **Structural scripts are copied, not adapted.** Take `scripts/` wholesale and write config on top of `defaultCheckConfigs`. Reimplementing a check from its doc is how three separate deployments each ended up with one that had silently stopped matching part of what the doc promised.
- **oxlint rules do need adapting** — they are written against one standard layout and their path patterns have to be repointed. Parallelize with one subagent per tag directory. Have them write rules first and register in `oxlint/plugin.ts` in one pass afterwards rather than editing that file concurrently.

Procedures for both are in [enforcement-implementation.md](references/enforcement-implementation.md).

**Every rule ships with a permanent spec, and one of its cases is adversarial.** A rule's failure mode is silent: when it stops matching it goes green, not red. Verifying it once against the shape you had in mind and throwing the check away is how a tier ends up governing its canonical examples and nothing else. The adversarial case — the violation written the way your rule *misses* — is the one that decides whether the rule works.

**Done when:** Numbered phases with specific file-level changes, the rules that activate in each phase, and a verification step. Every rule has its spec, and the suite runs in the gate.

### Phase 5: Assemble the plan document

Write the plan to `docs/plans/<date>-enforced-architecture-plan.md` (e.g., `docs/plans/2026-02-19-enforced-architecture-plan.md`).

Combine all phases into a single document:

1. **Decision Summary** — Core architectural decisions and rationale. Which configurable choices were made and why (including documentation depth).
2. **Target Architecture** — Directory layout (annotated tree), responsibility split table, dependency graph, public API conventions, server/client file naming.
3. **Import Boundary Matrix** — Top-level matrix, within-feature boundaries, cross-feature rules, SDK containment configuration.
4. **Rule Selection** — Included rules table (rule + adaptation notes) and excluded rules table (rule + reason). See Phase 3 for the format.
5. **Documentation Spec** — Which CLAUDE.md sections to generate and which docs/architecture/ files to create. Content checklist per [documentation-model.md](references/documentation-model.md).
6. **Implementation Checklist** (greenfield) or **Migration Plan** (existing) — From Phase 4.
7. **Current Violations** (migration only) — Prioritized from the audit, with specific file paths and fix descriptions.

**Important:** The plan document lives in the project repo and will be read by agents in future sessions. Include this reference for rule implementation:

> Rule templates are in the `enforced-architecture` skill (`~/.claude/skills/enforced-architecture/references/rules/`). Each rule in this plan references its template. **oxlint rules:** read the template, adapt paths and patterns to this project's structure, and write the result to `oxlint/` with its spec, registered in `oxlint/plugin.ts`. **Structural scripts:** copy the module and the `scripts/` substrate unmodified, register it, and put every project-specific value in `arch.config.ts` — the rule's *Adapt* section names the keys. Do not reimplement one from its doc.

## Tone

Be opinionated. Err on the side of stricter boundaries — relaxing rules is cheap, tightening them after violations have been copied as patterns is expensive.

Calibrate honestly. Not every codebase needs every layer. Not every rule earns its enforcement cost. The right amount of structure is the minimum needed to maintain dependency invariants — no more.

The output should be domain-agnostic — define structural boundaries, not feature-specific behavior.
