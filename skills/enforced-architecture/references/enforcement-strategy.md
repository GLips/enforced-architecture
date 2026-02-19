# Enforcement Strategy

The two-layer enforcement model, three-tier pipeline, and rule design principles.

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
- Barrel direction violations (index.ts importing from server.ts)

**What GritQL cannot catch:**
- Anything requiring cross-file analysis (cycles, file sizes, coupling metrics)
- Anything requiring filesystem awareness (does this feature have a repo/ directory?)
- Transitive import analysis (does this barrel transitively pull in server-only code?)

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

All checks run in parallel at commit time: Biome lint (GritQL rules), structural scripts, type checking, and tests.

- `biome check --write` auto-formats and re-stages silently. Agents never see formatting issues.
- GritQL rules (inside `biome lint`) catch per-file violations.
- Structural scripts catch cross-file violations.
- Type checking catches type errors introduced by import changes.
- Tests catch behavioral regressions.

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
