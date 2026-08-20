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

## Test-Driven Migration

Activate enforcement rules **at the start** of each phase, not at the end. Run `check:arch` immediately — the violations are your migration TODO list. The rules tell the implementing agent exactly what needs to change and how (error messages are designed for agents). This is test-driven migration: the rules define the target state, the failures guide the work, and a clean run confirms completion.

Activation-time violations also exercise the rules — but only the rules that fire. Zero matches at activation is a prompt to suspect the rule, not to celebrate: a dead rule and a clean codebase produce the same green run, and the adversarial fixture is the only thing that tells them apart.

## Phase Template

Each migration phase specifies:

| Field | Content |
|---|---|
| **Goal** | One sentence: what invariant does this phase establish? |
| **Rules activated** | Which enforcement rules become active at the START of this phase — write/enable the rule, then run `check:arch` to get the violation list |
| **Changes** | Fix each violation reported by the newly active rules. Classify each fix as mechanical or judgment. |
| **Verification** | `check:arch`, `typecheck`, `test`, `dev` — each run independently, all must pass before the next phase starts. Chained with `&&`, the first failure hides the rest. |
| **No shims** | No temporary compatibility layers. Each phase is complete in itself. |

---

## Example Migration Sequence

Every phase runs the same loop — activate its rules, run `check:arch`, work the violation list, verify — so only what differs between phases is listed. The last column is the work that cannot be batched.

| # | Goal | Rules activated | Judgment inside it |
|---|---|---|---|
| 1 | The enforcement pipeline exists and passes trivially | none | — |
| 2 | Only designated modules reach the database | `boundary/db-isolation`, plus import protection for `infrastructure/db/**` | Per violation: move the query into a repo module, into a controller, or behind a new server function |
| 3 | External SDKs are reached only through infrastructure adapters | `boundary/sdk-containment`, `boundary/client-server-infra` | Which SDKs are security-sensitive or configuration-heavy enough to wrap, and each wrapper's API |
| 4 | Features expose public APIs through barrels | `api/feature-public-api`, `api/domain-public-api`, `api/barrel-direction`, `api/server-import-context` | What each feature's public API should expose |
| 5 | Boundary-crossing imports use `@/` | `boundary/cross-boundary-alias` | — |
| 6 | Files live in the right layer and direction is enforced | `placement/layer-direction`, `placement/schema-placement`, `placement/server-fn-placement`, `boundary/domain-purity`, `boundary/route-thinness`, `boundary/shared-ui-purity`, `boundary/shared-purity`, `boundary/server-no-upward` | A `createServerFn` outside `controllers/` may need refactoring to move; domain logic with side effects has to land in a feature or in infrastructure |
| 7 | Cross-file constraints are enforced | `graph/domain-cycles`, `graph/feature-deps`, `api/barrel-purity`, `boundary/layer-occupancy`, `health/file-size`, `health/trampolines` (warning) | Splitting oversized files, breaking cycles, adding repo layers where controllers bypass them |

Phase 1 is the only one with no violation list to work, and it is all setup: `lint/oxlint/` with an empty `plugin.ts` named in `.oxlintrc.json`, `lint/structural/` with an empty registry, `check:arch` and `check:structural` in `package.json`, pre-commit hooks, and framework import protection with empty deny lists.

Phase 5 carries an ordering constraint the others do not: build [graph/import-graph](lint/structural/graph/import-graph.md) first. `boundary/cross-boundary-alias` is its first consumer and has nothing to run against until the graph exists.

---

## Common Pitfalls

**Activating too many rules at once.** Hard to debug which change caused which violation. Activate rules incrementally, verify after each.

**Not verifying after each phase.** Violations compound: a missed import rewrite in Phase 4 causes cascading errors in Phases 5 and 6.

**Creating shim layers "temporarily."** They become permanent. No re-export wrappers, no compatibility adapters, no "we will clean this up later" modules. Each phase is complete in itself.

**Moving files without updating all imports.** After any file move, verify with typecheck. TypeScript will catch broken imports that grep might miss. Use the IDE's rename/move refactoring when available.

**Fixing violations in the wrong order.** If a file has both a cross-boundary alias violation and a layer direction violation, fix the layer direction first. Moving the file to the correct layer changes the import path, making the alias fix different.

---
