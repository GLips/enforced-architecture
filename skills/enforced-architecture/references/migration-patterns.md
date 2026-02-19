# Migration Patterns

How to migrate an existing codebase to the enforced architecture. Decomposition, sequencing, and verification strategies.

---

## Core Principle

Every migration phase produces a clean repo that passes all rules applicable at that point. No phase leaves the codebase in a broken state. The repo is shippable after every phase.

---

## Change Classification

For every proposed change in a migration, classify as:

**Mechanical** -- File moves, import rewrites, barrel creation. Scriptable via search-and-replace or codemod. Low risk. Can be batched aggressively.

**Judgment-required** -- Logic refactoring, API redesign, dependency inversion, ownership decisions (which feature owns this code?). Needs individual attention and understanding of the domain.

Separate these in your migration plan. Mechanical changes are safe to batch in large commits. Judgment changes need focused commits with clear rationale.

---

## Sequencing Strategy: Inside-Out

Migration proceeds from foundational invariants outward to surface-level conventions:

1. **Enforcement infrastructure** -- Set up the tools before activating any rules
2. **DB isolation** -- Foundational boundary, fewest dependencies, highest value
3. **Infrastructure containment** -- SDK wrapping, auth adapter isolation
4. **Feature boundaries** -- Public API enforcement, barrel creation
5. **Cross-boundary aliases** -- Mechanical rewrites of relative imports
6. **Internal feature layers** -- Layer occupancy, intra-feature direction
7. **Structural checks** -- File size, cycles, coupling, trampolines

Why inside-out: each phase builds on the previous. DB isolation must exist before feature boundaries make sense -- a feature calling the DB directly violates both rules, and fixing the foundational one first prevents redundant work. Infrastructure containment must exist before feature boundaries can be meaningful -- wrapping SDKs creates the adapter layer that features will import through.

---

## Phase Template

Each migration phase specifies:

| Field | Content |
|---|---|
| **Goal** | One sentence: what invariant does this phase establish? |
| **Rules activated** | Which enforcement rules become active at the end of this phase |
| **Changes** | Specific file moves, import rewrites, logic refactoring. Each classified as mechanical or judgment. |
| **Verification** | `bun run check:arch && bun run typecheck && bun run test`. All must pass. |
| **No shims** | No temporary compatibility layers. Each phase is complete in itself. |

---

## Example Migration Sequence

### Phase 1: Enforcement Infrastructure

**Goal:** The enforcement pipeline exists and runs successfully (trivially, with no rules active).

**Rules activated:** None. Infrastructure only.

**Changes (all mechanical):**
- Create `biome/` directory (empty or with non-architectural rules only)
- Create the orchestrator script skeleton (no check functions yet)
- Add `"check:arch"` and `"check:structure"` to `package.json` scripts
- Configure pre-commit hooks
- Configure framework import protection (start with empty deny lists)

**Verification:** `bun run check:arch` runs and passes trivially. `bun run dev` starts clean. Pre-commit hooks fire on next commit.

---

### Phase 2: DB Isolation

**Goal:** Only designated modules access the database layer. All other code uses server functions.

**Rules activated:** `boundary/db-isolation`, framework import protection for `infrastructure/db/**`.

**Changes:**
- Move DB client and schema to `infrastructure/db/` if not already there (mechanical)
- Identify all files importing DB outside `infrastructure/`, `features/*/repo/`, and `features/*/controllers/` (mechanical -- grep for import patterns)
- For each violation, decide: move the DB query into a repo module, move it into a controller, or create a server function (judgment)
- Create the `boundary/db-isolation` GritQL rule in `biome/`
- Add `infrastructure/db/**` to framework import protection client deny lists

**Verification:** `bun run check:arch` passes with the DB isolation rule active. No client-side code can reach the DB.

---

### Phase 3: Infrastructure Containment

**Goal:** External SDKs are accessed only through infrastructure adapter modules.

**Rules activated:** `boundary/sdk-containment`, `boundary/client-server-infra`.

**Changes:**
- Identify all third-party SDKs with security sensitivity or configuration complexity (judgment)
- Create `infrastructure/integrations/` wrappers for each identified SDK (judgment -- API design)
- Move SDK imports from feature code to infrastructure wrappers (mechanical)
- Update feature code to import wrappers via `@/infrastructure/integrations/` (mechanical)
- Create the GritQL rules for SDK containment and client-server infrastructure boundaries
- Add infrastructure paths to framework import protection

**Verification:** `bun run check:arch` passes. No feature code imports raw SDK packages.

---

### Phase 4: Feature Boundaries

**Goal:** Features expose public APIs through barrels. External consumers use barrels, not internal paths.

**Rules activated:** `api/feature-public-api`, `api/domain-public-api`, `api/barrel-direction`, `api/server-import-context`.

**Changes:**
- Create `index.ts` barrel for every feature (mechanical)
- Create `server.ts` barrel for features with server-only cross-feature exports (mechanical)
- Identify all cross-feature deep imports (mechanical -- grep for `@/features/.*/` patterns beyond barrels)
- Rewrite cross-feature imports to use barrels (mechanical, but requires populating barrels first)
- Decide what each feature's public API should expose (judgment -- API design)
- Create GritQL rules for public API enforcement

**Verification:** `bun run check:arch` passes. All cross-feature imports go through barrels.

---

### Phase 5: Cross-Boundary Aliases

**Goal:** All imports crossing top-level boundaries use `@/` aliases instead of relative paths.

**Rules activated:** `boundary/cross-boundary-alias`.

**Changes (all mechanical):**
- Find all relative imports that cross boundaries: `../` paths resolving from one top-level directory to another, or between features
- Rewrite each to use the `@/` alias
- Create the `boundary/cross-boundary-alias` GritQL rule

**Verification:** `bun run check:arch` passes. All boundary-crossing imports use `@/`.

---

### Phase 6: Layer Direction and Placement

**Goal:** Files live in the correct layers. Layer direction is enforced.

**Rules activated:** `boundary/domain-purity`, `boundary/route-thinness`, `boundary/shared-ui-purity`, `structure/server-fn-placement`, `boundary/server-no-upward`, `boundary/shared-purity`, `structure/schema-placement`.

**Changes:**
- Move misplaced files to correct layer directories (mechanical)
- Move `createServerFn` calls from non-controller locations to `controllers/` (judgment -- may require refactoring)
- Move domain logic with side effects into features or infrastructure (judgment)
- Create remaining GritQL rules

**Verification:** `bun run check:arch` passes with all per-file rules active.

---

### Phase 7: Structural Checks

**Goal:** All cross-file constraints are enforced.

**Rules activated:** `graph/domain-cycles`, `health/file-size`, `health/trampolines` (non-blocking), `boundary/layer-occupancy`, `graph/feature-deps`, `api/barrel-purity`.

**Changes:**
- Implement check functions in the orchestrator script
- Create delegated TypeScript scripts for complex analysis
- Fix any violations found: split oversized files, break cycles, add repo layers where controllers bypass them
- Track known-oversized files in the file-size check's exclusion list with TODOs

**Verification:** `bun run check:arch` passes with all structural checks active. Full pipeline is operational.

---

## Common Pitfalls

**Activating too many rules at once.** Hard to debug which change caused which violation. Activate rules incrementally, verify after each.

**Not verifying after each phase.** Violations compound. A missed import rewrite in Phase 4 causes cascading errors in Phase 5 and 6. Run `bun run check:arch && bun run typecheck && bun run test` after every phase.

**Creating shim layers "temporarily."** They become permanent. No re-export wrappers, no compatibility adapters, no "we will clean this up later" modules. Each phase is complete in itself.

**Moving files without updating all imports.** After any file move, verify with typecheck. TypeScript will catch broken imports that grep might miss. Use the IDE's rename/move refactoring when available.

**Fixing violations in the wrong order.** If a file has both a cross-boundary alias violation and a layer direction violation, fix the layer direction first. Moving the file to the correct layer changes the import path, making the alias fix different.

**Batching judgment changes with mechanical changes.** Mechanical changes (import rewrites) are safe to batch in large commits. Judgment changes (API redesign, ownership decisions) need focused commits with clear rationale. Mixing them makes review impossible.

---

## Verification Checklist

After every migration phase:

```bash
# 1. Architecture rules pass
bun run check:arch

# 2. Types compile
bun run typecheck

# 3. Tests pass
bun run test

# 4. Dev server starts
bun run dev
```

All four must pass. If any fails, fix it before moving to the next phase. Do not accumulate failures across phases.
