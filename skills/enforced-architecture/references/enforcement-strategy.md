# Enforcement Strategy

The two-layer enforcement model, three-tier pipeline, and rule design principles.

---

## Layer 0: Types

Before writing a rule, check whether the type system can hold the constraint instead. A typed closed set is strictly better than a lint rule on the same axis: it fails at compile time rather than at lint time, it needs no exclusion list, it cannot fall out of sync with what it guards, and it surfaces in autocomplete — so the agent sees the allowed values while writing, not the forbidden one after.

This is most of the answer for anything shaped like "the value must come from this closed set":

- A variant prop should be a union of token names (`size: "s" | "m" | "l"`), not a `string` a rule then polices.
- A component's own props should be semantic and closed — a `tone`, not an open `color`.
- A helper that builds a class or a style should take the union, not the value.

Types have one structural gap, and it is the reason the other layers exist: **libraries you did not write also accept escape hatches.** A component library may type `gap` as a token union *and* accept a raw number; a `className` is a string no matter what. Layer 0 closes what it can, and Layers 1 and 2 police what it cannot.

Write the rule only for the leaks. A rule that duplicates a constraint the types already hold is maintenance with no coverage.

---

## Two-Layer Enforcement

### Layer 1: GritQL Per-File Rules (via Biome)

GritQL rules examine a single file's imports against AST patterns. They detect violations visible in one file: "this file in `shared/ui/` imports from `@/features/`" or "this file in `routes/` imports from `@/infrastructure/db/`."

**Runtime characteristics:**
- Real-time in the editor via Biome language server (immediate feedback)
- Pre-commit via `biome lint`
- CI via `biome lint`

**What GritQL catches:**
- Layer direction violations (UI importing DB, routes importing infrastructure)
- SDK containment breaches (raw package imports outside infrastructure)
- Cross-boundary alias violations (relative imports crossing top-level boundaries)
- Public API enforcement (deep imports into feature internals)
- Server function placement and validation
- File placement violations (schema outside infrastructure/db/schema/)
- Barrel direction violations (index.ts importing from index.server.ts)

**What GritQL cannot catch:**
- Anything requiring cross-file analysis (cycles, file sizes, coupling metrics)
- Anything requiring filesystem awareness (does this feature have a repo/ directory?)
- Transitive import analysis (does this barrel transitively pull in server-only code?)
- **Anything whose answer depends on where the importing file sits.** Whether `../../beta` leaves the current feature is a function of the importing file's depth, not of the import string, so it has to be *resolved and compared*, never matched. This is the least obvious of the four and the most damaging: the rule looks right, passes its fixture, and silently permits the shortest spelling of the violation. See [rules/graph/import-graph.md](rules/graph/import-graph.md).
- **Anything that counts.** No per-file aggregation exists. Hook counts, prop counts, and "how many components does this file export" are all scripts.
- **Any named-import clause, matched as a snippet.** A metavariable spans a whole list only where Grit treats the position as a list pattern, and the named-import clause is not one. `` `import { $a } from $src` `` matches a single-specifier import and misses `import { a, b }`; `` `import { $a, $... } from $src` `` matches nothing at all; `` `import { $... } from $src` `` fails to load. There is no snippet form that works. Match `JsModuleSource()`, the node every static import and re-export shares. Nothing in a pattern reveals whether its position is a list, so this is not something to settle by reading — a parameter list *is* one, and `` `function $name($a) { $_ }` `` accordingly matches every arity.

### Layer 2: Structural Scripts (Cross-File Analysis)

Structural scripts analyze relationships between files or properties that span the codebase. They require building graphs, counting lines, or checking filesystem structure.

**Runtime characteristics:**
- Pre-commit via an orchestrator script
- CI via the same script
- NOT real-time in editor (too slow, requires full codebase scan)

**What structural scripts catch:**
- Circular dependencies between domains
- File size limits (warn and fail thresholds)
- Trampoline detection — pass-through functions that add no value
- Layer occupancy enforcement — controllers bypassing present repo/ layers
- Cross-feature dependency graph cycles and coupling thresholds
- Barrel purity — client-safe barrels transitively importing server-only code

See [rules/overview.md](rules/overview.md) for the complete rule catalog with mechanisms, blocking status, and links to each rule's template.

---

## Three-Tier Pipeline

### Tier 1: Immediate (IDE)

GritQL rules surface in the editor via the Biome language server. An agent sees violations as squiggly underlines the moment it writes an import. This is the fastest feedback loop.

**Scope:** Only per-file violations. Structural checks do not run in the editor.

**Design constraint:** Only surface violations that require the agent to change its approach. Do not surface formatting, import ordering, or anything auto-fixable. Those are handled silently at pre-commit.

### Tier 2: Pre-commit

The formatter runs first and alone, then the read-only gates run in parallel: Biome lint (GritQL rules), structural scripts, type checking, and tests.

- Formatting is applied and re-staged silently. Agents never see formatting issues.
- GritQL rules (inside `biome lint`) catch per-file violations.
- Structural scripts catch cross-file violations.
- Type checking catches type errors introduced by import changes.
- Tests catch behavioral regressions.

**Scope follows the check.** Agents commit against a shared working tree, so a commit must not block on another agent's unfinished work.

- **Format and lint — the staged files only.** A repo-wide formatter would rewrite files another agent is mid-edit on, and a per-file violation elsewhere isn't this commit's problem.
- **Type checking, tests, structural checks — the whole repo.** These catch what is broken no matter who wrote it. Their advisory warnings still narrow to the staged diff, so a commit isn't nagged about pre-existing drift; their errors do not narrow.

Tier 3 and manual full runs warn repo-wide — the full picture belongs there. See [enforcement-implementation.md](enforcement-implementation.md) for the mechanism.

**Target latency:** Under 15 seconds for most projects. Parallel execution is critical.

### Tier 3: CI

Same checks as Tier 2. Safety net for hook bypass (`--no-verify`). Required to pass for PR merge.

CI is the last line of defense, not the primary feedback mechanism. If a violation makes it to CI, the developer experience has already failed — the goal is to catch everything at Tier 1 or Tier 2.

---

## Rule Design Principles

### Every rule is blocking by default

Non-blocking requires explicit justification. Agents do not distinguish warnings from errors in their behavior. A non-blocking rule trains agents to ignore violations.

**Valid reasons for non-blocking:**
- Heuristic checks requiring semantic judgment (trampoline detection)
- Warning tiers before hard limits (file size)
- Coupling metrics where the threshold is a signal, not a hard invariant

**Invalid reasons for non-blocking:**
- "We will enforce it later" — violations accumulate. Agents copy patterns.
- "It might have false positives" — a false positive costs minutes. A missed violation costs days.

### Error messages target AI agents

Rule error messages are the primary documentation for violations. Each message must enable the agent to fix the violation without reading any other documentation.

**GritQL messages** are displayed by Biome's diagnostic formatter (with file path, line number, and rule reference). Write the `register_diagnostic` message to explain what's wrong, why, and how to fix.

**Structural script messages** use this format:

```
FAIL [rule-name] path/to/file.ts
  What's wrong in one sentence.
  What to do about it, with specific paths.

WARN [rule-name] path/to/file.ts
  What's wrong in one sentence.
  What to do about it.
```

### Rules detect the narrowest possible violation

A rule that catches too much trains agents to work around it. Each rule targets one specific import pattern or structural property. If a rule has many exceptions, it is probably too broad.

### Global test exclusion

All rules (except `boundary/no-test-imports`) exclude test files from their scope:
- `**/*.test.*`
- `**/*.integration.test.*`
- `**/__tests__/**`
- `**/src/test/**`

Tests need cross-boundary imports for setup and assertions. This exclusion is applied globally in every GritQL rule's file pattern and in the structural scripts, not repeated per-rule.
