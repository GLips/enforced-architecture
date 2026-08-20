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

### Layer 1: Per-File Rules (oxlint JS plugins)

A rule is `create(context)` returning a visitor keyed by AST node type, plus `context.filename`. It examines one file and detects violations visible in that file: "this file in `shared/ui/` imports from `@/features/`" or "this file in `routes/` imports from `@/infrastructure/db/`."

**Runtime characteristics:**
- Real-time in the editor via oxlint's language server, which publishes plugin diagnostics on open and on change (immediate feedback)
- Pre-commit via `oxlint` over the staged files
- CI via `oxlint src`

**What the per-file rules catch:**
- Layer direction violations (UI importing DB, routes importing infrastructure)
- SDK containment breaches (raw package imports outside infrastructure)
- Cross-boundary alias violations (relative imports crossing top-level boundaries)
- Public API enforcement (deep imports into feature internals)
- Server function placement and validation
- File placement violations (schema outside infrastructure/db/schema/)
- Barrel direction violations (index.ts importing from index.server.ts)

**What a per-file rule cannot catch:**
- Anything requiring cross-file analysis (cycles, coupling metrics, any claim about a *set* of files)
- Anything requiring filesystem awareness (does this feature have a repo/ directory?)
- Transitive import analysis (does this barrel transitively pull in server-only code?)
- **Anything whose answer depends on where the importing file sits.** Whether `../../beta` leaves the current feature is a function of the importing file's depth, not of the import string, so it has to be *resolved and compared*, never matched. This is the least obvious of these and the most damaging: the rule looks right, passes its spec, and silently permits the shortest spelling of the violation. See [lint/structural/graph/import-graph.md](lint/structural/graph/import-graph.md).
- **Anything that counts across files.** A rule instance sees one file and nothing else. Within a file it *can* aggregate — record what the visitor passes and decide at `"Program:exit"` — but a file's line count is a question about the file rather than about anything in it, so `health/file-size` is a structural check. A rule's tier is its directory — `lint/oxlint/` or `lint/structural/` — and [lint/overview.md](lint/overview.md) maps which tags have a half in each.

### Layer 2: Structural Scripts (Cross-File Analysis)

Structural scripts analyze relationships between files or properties that span the codebase. They require building graphs, counting lines, or checking filesystem structure.

**Runtime characteristics:**
- Pre-commit via an orchestrator script
- CI via the same script
- NOT real-time in editor (too slow, requires full codebase scan)

They ship as code with one config object rather than as algorithms to reimplement — cycles, coupling thresholds, layer occupancy, barrel purity, file size, trampolines. Start at [lint/overview.md](lint/overview.md) to pick tags; blocking status per rule is in `lint/structural/<tag>/overview.md`.

---

## Three-Tier Pipeline

### Tier 1: Immediate (IDE)

Per-file rules surface in the editor via oxlint's language server, which publishes JS-plugin diagnostics like any built-in rule. An agent sees violations as squiggly underlines the moment it writes an import. This is the fastest feedback loop.

**Scope:** Only per-file violations. Structural checks do not run in the editor.

**Design constraint:** Only surface violations that require the agent to change its approach. Do not surface formatting, import ordering, or anything auto-fixable. Those are handled silently at pre-commit.

### Tier 2: Pre-commit

The formatter runs first and alone, then the read-only gates run in parallel: `oxlint` (the JS-plugin rules), structural scripts, type checking, and tests.

- Formatting is applied and re-staged silently. Agents never see formatting issues. oxlint does not format — the formatter is a separate tool, and it is the hook's only writer.
- Per-file rules (inside `oxlint`) catch per-file violations.
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

One check runs only here: `duplication` (jscpd). Scanning the whole tree for copy-paste costs more than the 15-second hook budget, and a clone is never the finding that has to stop a commit — but it is precisely what an agent leaves behind when it did not find the code path that already existed. Mechanism and thresholds in [enforcement-implementation.md](enforcement-implementation.md).

CI is the last line of defense, not the primary feedback mechanism. If a violation makes it to CI, the developer experience has already failed — the goal is to catch everything at Tier 1 or Tier 2.

---

## Rule Design Principles

### Every rule is blocking by default

Non-blocking needs explicit justification, and only three reasons qualify: a heuristic needing semantic judgment (trampoline detection), a warning tier in front of a hard limit (file size), and a coupling threshold that is a signal rather than an invariant. The argument for why, and the reasons that do *not* qualify: [architecture-principles.md](architecture-principles.md#4-all-rules-blocking-from-day-one).

### Error messages target AI agents

Rule error messages are the primary documentation for violations. Each message must enable the agent to fix the violation without reading any other documentation.

**Per-file rule messages** live in the rule's `meta.messages`, keyed by the `messageId` it reports. oxlint renders one as `error <plugin>(<rule>): <message>` with the file path and line. The rule key is its file name, so the diagnostic id is also the path to the rule that raised it — an agent that wants the reasoning can open the rule. Write the message to explain what's wrong, why, and how to fix it.

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

All rules (except `boundary/no-test-imports`) exclude test files and one-off scripts from their scope:
- `**/*.test.*`
- `**/*.integration.test.*`
- `**/__tests__/**`
- `**/src/test/**`
- `**/scripts/**`

Tests need cross-boundary imports for setup and assertions, and a script is not part of the shipped module graph. The exclusion lives in exactly two places — `isArchitectureExemptPath` in `lint/oxlint/lib/`, and the structural tier's file collection — and is never repeated per rule. Per-rule copies drift, and they drift identically: every rule carrying its own near-copy of the exemption over-matches the same way, and each one has to be found separately.
