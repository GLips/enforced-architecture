---
name: enforced-architecture
description: >
  Generate a mechanically enforced architecture plan for a TypeScript codebase. Use when establishing or redesigning the architecture of any TypeScript project with machine-checkable import boundary enforcement. Produces a plan document: audit, target architecture, GritQL + structural script enforcement rules, and a phased implementation plan. Designed for codebases where AI agents are the primary code writers.
disable-model-invocation: true
---

# Enforced Architecture

Generate a mechanically enforced architecture plan for a TypeScript codebase. The output is a plan document that can be executed by agents in future sessions.

## Stack Assumptions

This skill assumes Bun, TanStack Start, Biome/GritQL, Drizzle, Postgres, React, Zod, and lefthook. Examples and rule templates use these packages directly. If your project uses a different stack, the architectural principles still apply — translate the patterns to your framework and tooling.

## Reference Material

Read these references before and during the process:

| Reference | Read when | Purpose |
|---|---|---|
| [architecture-principles.md](references/architecture-principles.md) | Before starting | Core philosophy, layer model, dependency direction |
| [directory-model.md](references/directory-model.md) | Phase 2 (target architecture) | Directory templates, responsibility split, configurable choices |
| [import-boundaries.md](references/import-boundaries.md) | Phase 2 (boundaries) | Import boundary matrix, cross-boundary rules, public API conventions, SDK containment |
| [feature-patterns.md](references/feature-patterns.md) | Phase 2 (feature design) | Feature scaling templates, layer occupancy, controllers/service/repo/ui |
| [server-client-boundaries.md](references/server-client-boundaries.md) | Phase 2 (bundle splitting) | TanStack Start server/client conventions, createServerFn patterns, importProtection config |
| [enforcement-strategy.md](references/enforcement-strategy.md) | Phase 3 (rule design) | Two-layer enforcement (GritQL + scripts), three-tier pipeline, rule field template |
| [enforcement-implementation.md](references/enforcement-implementation.md) | Phase 4 (implementation) | Biome config, lefthook, package.json scripts, structural script orchestration |
| [documentation-model.md](references/documentation-model.md) | Phase 4 (documentation) | What to document in CLAUDE.md and docs/architecture/, content checklists |
| [migration-patterns.md](references/migration-patterns.md) | Phase 4 (migration) | Atomic phase decomposition, sequencing, verification |
| [rules/overview.md](references/rules/overview.md) | Phase 3–4 (rule catalog) | Complete rule index with tags, mechanisms, and links to templates |

Rule templates live in `references/rules/` organized by tag:

| Directory | Tag | Contents |
|---|---|---|
| `rules/boundary/` | boundary | Layer direction, import restrictions — GritQL + scripts |
| `rules/api/` | api | Public API surface, barrel conventions — GritQL + scripts |
| `rules/structure/` | structure | File placement, naming, server function validation — GritQL |
| `rules/graph/` | graph | Cross-file dependency analysis — scripts |
| `rules/health/` | health | Code quality metrics — scripts |
| `rules/react/` | react | React-specific code smell detection — GritQL + scripts |

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
2. **Intra-feature layering** — Enforced `controllers/ → service/ → repo/ → ui/` internal structure, or flat features with just `controllers/`?
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

**Calibration:** For every proposed layer, directory, or abstraction, ask: does this earn its place? If a service layer would just forward calls, don't propose it.

**Done when:** An agent reading only the target structure section could answer "where does this code live?" for any type of work.

### Phase 3: Design enforcement rules

Read [enforcement-strategy.md](references/enforcement-strategy.md) for the two-layer model. Read [rules/overview.md](references/rules/overview.md) for the complete rule catalog.

**Process:**
1. Review the rule catalog. Select rules that apply to this project's architecture.
2. For each selected rule, read its template in the appropriate `rules/<tag>/` directory.
3. Adapt each rule to the project's specific directory names, import patterns, and conventions.
4. Tag each rule with its enforcement mechanism: **GritQL** (per-file, real-time) or **structural script** (cross-file, pre-commit).
5. Add project-specific rules not covered by the catalog.

The plan's rule set section should be lean — a selection and adaptation table, not a duplication of template content. The templates already contain mechanism, blocking status, error messages, and full implementation details. The plan only needs to capture what's project-specific:

**Included rules table** — For each selected rule:

| Field | Required content |
|---|---|
| **Rule** | `tag/descriptive-name` format (e.g., `boundary/db-isolation`) |
| **Adaptation** | Project-specific path patterns, package lists, thresholds, or "Standard" if no adaptation needed |

**Excluded rules table** — For each rule from the catalog that was NOT selected, with the reason (e.g., "No domains layer").

Implementing agents read the full template from the skill's `references/rules/<tag>/` directory for everything else (mechanism, blocking status, error messages, implementation patterns).

**Done when:** Every architectural constraint has a corresponding rule selected from the catalog (or added as project-specific). Every selected rule notes its project-specific adaptations.

### Phase 4: Plan implementation

Read [enforcement-implementation.md](references/enforcement-implementation.md) for tooling setup. Read [migration-patterns.md](references/migration-patterns.md) for migration sequencing.

**Greenfield sequence:**
1. Biome config + GritQL rule files in `biome/` directory
2. Structural check scripts in `scripts/`
3. Package.json scripts (`check:arch`)
4. Lefthook pre-commit config
5. Framework import protection (vite.config.ts)
6. Directory structure with empty barrels
7. Generate documentation per [documentation-model.md](references/documentation-model.md) — CLAUDE.md rules section, and docs/architecture/ files if chosen
8. Verify: `bun run check:arch && bun run dev`

**Migration:** Decompose into atomic phases per [migration-patterns.md](references/migration-patterns.md). Each phase produces a clean repo.

**Implementation guidance for rule writing:** Rules require project-specific adaptation — they are not copy-pastable from templates. When implementing, launch subagents per rule tag directory to parallelize:
- One subagent for `boundary/` rules (reads templates, adapts to project paths, writes `.grit` files)
- One subagent for `api/` rules
- One subagent for `structure/` rules
- One subagent for structural scripts (`graph/`, `health/`)
- One subagent for `react/` rules (if applicable)

Each subagent reads the relevant templates from the skill's `references/rules/<tag>/` directory, reads the project's directory structure, and writes the adapted rule into the project's `biome/` directory (for GritQL rules) or `scripts/` directory (for structural scripts). The parent agent verifies with `bun run check:arch` after all rules land.

**Smoke testing is required for every rule.** After writing each rule, create a minimal fixture file that should trigger it and verify the diagnostic appears. For GritQL rules, write a `.ts` file with the violating import and run `bunx biome lint` against it. For structural scripts, create a fixture directory structure and run the script. A rule that hasn't been smoke tested is a rule you don't know works. See [enforcement-implementation.md](references/enforcement-implementation.md) for the smoke test procedure.

**Done when:** Numbered phases with specific file-level changes, the rules that activate in each phase, and a verification step. Every rule has been smoke tested.

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

> Rule templates are in the `enforced-architecture` skill (`~/.claude/skills/enforced-architecture/references/rules/`). Each rule in this plan references its template. Read the template, adapt paths and patterns to this project's structure, and write the result to `biome/` (GritQL rules) or `scripts/` (structural scripts).

## Tone

Be opinionated. Err on the side of stricter boundaries — relaxing rules is cheap, tightening them after violations have been copied as patterns is expensive.

Calibrate honestly. Not every codebase needs every layer. Not every rule earns its enforcement cost. The right amount of structure is the minimum needed to maintain dependency invariants — no more.

The output should be domain-agnostic — define structural boundaries, not feature-specific behavior.
