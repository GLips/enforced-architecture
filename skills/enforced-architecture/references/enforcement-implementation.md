# Enforcement Implementation

How to wire up the enforcement infrastructure. This covers the setup patterns — not the rules themselves (those live in [rules/](rules/overview.md)).

---

## Biome Configuration

Biome loads GritQL rules as plugins. Each `.grit` file in the project's `biome/` directory becomes a lint rule.

Key configuration points:
- Each plugin is an explicit path to a `.grit` file. Biome does not auto-discover plugins — every rule must be listed.
- `files.includes` scopes linting to `src/` and excludes generated files.
- `overrides` can disable plugins for config files (e.g., `vite.config.ts`) that legitimately import server-only packages.
- Use a flat `biome/` directory. Name files by tag and rule: `boundary-db-isolation.grit`, `api-feature-public-api.grit`, etc.

---

## Structural Script Orchestration

An orchestrator script runs all structural checks. Each check is a function (inline or delegated to a TypeScript script) that increments an `ERRORS` counter (blocking) or `WARNINGS` counter (non-blocking).

**Orchestration pattern:**
- Each check runs independently and reports its own violations.
- Blocking checks increment `ERRORS`. Non-blocking checks increment `WARNINGS`.
- Exit code 1 if any `ERRORS`. Exit code 0 if only `WARNINGS` or clean.
- Delegated TypeScript scripts use exit code 0 for pass/warnings-only and non-zero for errors.

Simple checks (file size, layer occupancy) can be inline shell functions. Complex checks (graph analysis, transitive import tracing) should be delegated to TypeScript scripts for maintainability.

---

## Pre-commit Configuration

Use lefthook (or husky, lint-staged, etc.) to run all checks in parallel at commit time:

- **Biome lint + format** — auto-formats, re-stages, and runs GritQL rules. Use `--write` so agents never see formatting issues.
- **Type checking** — catches type errors introduced by import changes.
- **Tests** — catches behavioral regressions.
- **Structural checks** — runs the orchestrator script.

All four should run in parallel since they don't depend on each other. Target latency: under 15 seconds.

---

## Package.json Scripts

Two architecture-specific scripts:
- `check:arch` — chains Biome lint then structural checks. Both must pass. This is the single command that verifies all architectural constraints.
- `check:structure` — runs only structural checks. Useful when iterating on script changes without re-running lint.

---

## Framework Import Protection

SSR frameworks with server/client bundle splitting (TanStack Start, Next.js, SolidStart) offer import protection configuration. This is a complementary defense layer — it catches server-only imports at dev/build time.

Configure two lists:
- **`client.specifiers`** — import paths denied from client bundles (e.g., `@/infrastructure/db/**`, `@/env.server`)
- **`client.files`** — file patterns denied from client bundles (e.g., `**/*.server.*`, `src/infrastructure/db/**`)

When adding a new server-only infrastructure module, add it to both lists. When adding a client-safe infrastructure module, skip the deny lists and update the infrastructure client boundary GritQL rule's allowlist.

---

## Biome GritQL Limitations

### No `#` Comments

Biome's GritQL compiler does not support `#` comments. The only diagnostic is "Failed to compile the Grit plugin" with no detail about the cause. All `.grit` rule files must use `//` comments exclusively. Keep documentation in the companion `.md` files or in `//` comment blocks within the `.grit` file.

### No `export ... from` Pattern Matching

The backtick pattern `` export $_ from $source `` does not match ES re-export syntax like `export { x } from "./server"`. Only `import` statements are reliably matched. For rules that need to catch re-exports, match the string literal directly (e.g., `` `"./server"` ``) instead of trying to match the export syntax. See `api/barrel-direction.grit` for an example.

### `$args` Matches Empty Parentheses

GritQL's metavariable `$args` matches even when there are zero arguments. The pattern `createServerFn($args)` matches both `createServerFn({ method: "POST" })` and `createServerFn()`. To exclude the empty case, use `! $args <: .` — the `.` (dot) matches an empty/absent node. See `structure/server-fn-validation.grit` for an example.

### No Per-File Counting

GritQL per-file rules cannot aggregate or count matches within a file. Rules that need counting (hook-count, prop-count, file-size) must be structural scripts.

---

## Adding a New GritQL Rule

1. Read the relevant rule template from `rules/<tag>/<name>.grit`
2. Adapt paths and patterns to the project's directory structure (the template's "Adapt" section explains what to customize)
3. Write the adapted rule to `biome/<tag>-<name>.grit`
4. Add the plugin path to `biome.json`'s `plugins` array
5. Smoke test (see below)
6. Run `bun run check:arch` to verify no false positives on existing code

## Adding a New Structural Check

1. Read the relevant rule template from `rules/<tag>/<name>.md`
2. Implement as an inline function or delegated TypeScript script
3. Wire it into the orchestrator: increment `ERRORS` for blocking, `WARNINGS` for non-blocking
4. Smoke test (see below)
5. Run `bun run check:arch` to verify

---

## Smoke Testing Rules

Every rule must be smoke tested after implementation. A rule that hasn't been verified against a real violation is a rule you don't know works. GritQL pattern matching is subtle — a misplaced regex escape or an incorrect filename pattern silently passes violations through.

### GritQL Rules

1. **Create a minimal fixture file** that should trigger the rule. Place it in a temporary location within `src/` that matches the rule's scope. The fixture should contain exactly one violating import.
2. **Run Biome lint** against the fixture: `bunx biome lint src/path/to/fixture.ts`
3. **Verify the diagnostic appears.** If it doesn't, check the filename pattern, import source regex, and exception list.
4. **Verify a valid file does NOT trigger.** Run the same lint against a file in an allowed directory.
5. **Delete the fixture file.**

### Structural Scripts

1. **Create a fixture that should trigger the check.** This may be a temporary file, directory, or modification.
2. **Run the orchestrator** or the individual script directly.
3. **Verify the expected output** — correct file path, threshold, or cycle path.
4. **Clean up the fixture.**

### Smoke Test Tracking

Include a checklist in the implementation plan. Every rule gets a row:

| Rule | Fixture | Expected diagnostic | Verified |
|---|---|---|---|
| boundary/db-isolation | `shared/test-violation.ts` importing `@/infrastructure/db` | "DB client/schema imports are restricted..." | [ ] |
| ... | ... | ... | [ ] |

The implementing agent fills in the "Verified" column as each rule is smoke tested. All rows must be checked before the implementation phase is complete.
