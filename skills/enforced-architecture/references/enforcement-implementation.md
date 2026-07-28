# Enforcement Implementation

How to wire up the enforcement infrastructure. This covers the setup patterns — not the rules themselves (those live in [rules/](rules/overview.md)).

---

## Biome Configuration

Biome loads GritQL rules as plugins. Each `.grit` file in the project's `biome/` directory becomes a lint rule.

Key configuration points:
- Each plugin is an explicit path to a `.grit` file. Biome does not auto-discover plugins — every rule must be listed.
- `files.includes` scopes linting to `src/` and excludes generated files.
- `overrides` can disable plugins for config files (e.g., `vite.config.ts`) that legitimately import server-only packages.
- Organize rules in subdirectories by tag: `biome/boundary/db-isolation.grit`, `biome/api/feature-public-api.grit`, `biome/structure/layer-direction.grit`, etc.

---

## Structural Script Orchestration

An orchestrator script runs all structural checks. Each check is a function (inline or delegated to a TypeScript script) that increments an `ERRORS` counter (blocking) or `WARNINGS` counter (non-blocking).

**Orchestration pattern:**
- Each check runs independently and returns its own findings — both errors (blocking) and warnings (non-blocking), each tied to the file it concerns.
- The orchestrator reports every error, reports the warnings that survive scoping (below), and counts both.
- Exit code 1 if any errors. Exit code 0 if only warnings or clean.
- Delegated TypeScript scripts use exit code 0 for pass/warnings-only and non-zero for errors.

Simple checks (file size, layer occupancy) can be inline shell functions. Complex checks (graph analysis, transitive import tracing) should be delegated to TypeScript scripts for maintainability.

### Staged-scoped warnings

At pre-commit, advisory warnings are scoped to the files the commit touches; blocking errors always surface repo-wide (the rationale lives in [enforcement-strategy.md](enforcement-strategy.md) under Tier 2). Two requirements make this work:

- **Each warning carries its file path as structured data** — a `{ file, message }` finding, not a path buried in the message string. Errors don't need it; they're never filtered. This is why warning-emitting checks *return findings* rather than incrementing a counter inline: a counter can't be filtered after the fact.
- **The orchestrator is handed the staged set and filters before reporting.** The set is *injected*, not discovered — the orchestrator reads an env var and stays agnostic to which pre-commit tool produced it. Unset means no filter, so CI and manual `check:arch` runs warn across the whole repo.

```typescript
// Unset (CI, manual run) => undefined => no filtering: warn across the repo.
const staged = process.env.STAGED_FILES?.split(/\s+/).filter(Boolean);
// A finding with no file can't be matched, so keep it rather than hide it.
const inDiff = (w: { file?: string }) =>
  !staged || w.file === undefined || staged.includes(w.file);

for (const { errors, warnings } of results) {
  errors.forEach(report);                    // always, repo-wide
  warnings.filter(inDiff).forEach(report);   // scoped to the staged diff
}
```

---

## Pre-commit Configuration

Use lefthook (or husky, lint-staged, etc.) to run all checks in parallel at commit time:

- **Biome lint + format** — auto-formats, re-stages, and runs GritQL rules. Use `--write` so agents never see formatting issues.
- **Type checking** — catches type errors introduced by import changes.
- **Tests** — catches behavioral regressions.
- **Structural checks** — runs the orchestrator script.

All four should run in parallel since they don't depend on each other. Target latency: under 15 seconds.

**Passing the staged set.** Pass the staged files to the orchestrator so it can scope warnings (see Structural Script Orchestration). Compute the set from git in the command itself rather than the pre-commit tool's file template:

```yaml
check-arch:
  # Errors surface repo-wide; warnings are scoped to this commit's staged files.
  run: STAGED_FILES="$(git diff --cached --name-only --diff-filter=ACMR)" bun run check:arch
```

The orchestrator only reads `STAGED_FILES`, so it stays agnostic to the pre-commit tool. `--diff-filter=ACMR` lists added/copied/modified/renamed paths (skipping deletions). The whole newline-separated list lands in one env value via `$(…)`.

**Gotcha — don't use the tool's file template inline.** It's tempting to write `STAGED_FILES="{staged_files}"` (lefthook) or the husky/lint-staged equivalent. It breaks: these templates quote each path individually, and a quoted list can't be the right-hand side of an env-var assignment — `ENV="a" "b" cmd` sets `ENV=a` and runs `b` as a command (exit 126, "permission denied"). File templates are built to be a command's *arguments*, not an env value. Computing the set from git sidesteps the quoting entirely.

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

## Matching Imports in GritQL

Most rules in the catalog are import rules, and they all match imports the same way. Follow this shape.

### When the rule only cares about the module

Match the module-source node and test its text. This is what nearly every `boundary/`, `api/`, and `structure/` rule does:

```
file(name=$filename, body=$program) where {
    $filename <: r".*/src/shared/ui/.*",
    ! $filename <: r".*\.test\.[tj]sx?$|.*\.integration\.test\.[tj]sx?$|.*__tests__.*|.*src/test/.*",

    $program <: contains bubble JsModuleSource() as $source where {
        $source <: r"\"@/features.*\"",
        register_diagnostic(span = $source, message = "…")
    }
}
```

`JsModuleSource` is the node every import and re-export shares, so one pattern covers all of them: any number of named specifiers, default, namespace (`import * as x`), combined (`import def, { x }`), side-effect (`import "x"`), multi-line, and `export { x } from "…"`. A plain string that happens to contain the same path is *not* a module source, so it does not match.

The node's text includes its quotes, and Grit regexes are anchored, so write `r"\"@/features.*\""` — or `r".*['\"]@/features.*['\"].*"` if you prefer to be explicit about both quote styles.

### When the rule cares which names were imported

Match the import, then the specifier. **Put the name test inside the `contains` predicate**, not after it:

```
pattern banned_component() { r"^(?:Textarea)$" }

$program <: contains bubble JsImport() as $import where {
    $import <: contains JsModuleSource() as $source,
    $source <: r".*['\"]@mantine/core['\"].*",
    ! $import <: r"(?s)import\s+type\s.*",
    $import <: contains or {
        JsShorthandNamedImportSpecifier() as $specifier where {
            $specifier <: banned_component()
        },
        JsNamedImportSpecifier(name = $specifier) where {
            $specifier <: banned_component()
        }
    },
    register_diagnostic(span = $specifier, message = "…")
}
```

Three details carry the weight:

- **The test goes inside the predicate.** Written as `contains or { … } as $specifier` with a separate `$specifier <: …` afterwards, only the *first* specifier is ever tested — `import { Button, Textarea }` passes silently. Inside the predicate, `contains` keeps searching until a specifier actually matches.
- **Two specifier nodes.** `JsShorthandNamedImportSpecifier` is `{ Textarea }`; `JsNamedImportSpecifier` is `{ Textarea as TA }`. Cover both.
- **Drop type-only imports** with `! $import <: r"(?s)import\s+type\s.*"`. A type import pulls in no runtime value.

Anchor the identifier alternation end to end (`r"^(?:Textarea)$"`) so `TextareaProps` does not match.

### CST node names are PascalCase

`JsImport`, `JsModuleSource`, `JsShorthandNamedImportSpecifier`, `JsNamedImportSpecifier`, `JsImportNamedClause`, `JsNamedImportSpecifiers`. A snake_case name fails with a bare "Failed to compile the Grit plugin" and no further detail, so check the casing first when a rule will not load. Field access works on these: `JsImportNamedClause(source = $s, named_specifiers = $ns)`.

Note that not every field name is valid — `JsModuleSource(value_token = $v)` fails to compile. Match the node and regex its text instead.

---

## Biome GritQL Limitations

### No `#` Comments

Biome's GritQL compiler does not support `#` comments. The only diagnostic is "Failed to compile the Grit plugin" with no detail about the cause. All `.grit` rule files must use `//` comments exclusively. Keep documentation in the companion `.md` files or in `//` comment blocks within the `.grit` file.

### `$args` Matches Empty Parentheses

GritQL's metavariable `$args` matches even when there are zero arguments. The pattern `createServerFn($args)` matches both `createServerFn({ method: "POST" })` and `createServerFn()`. To exclude the empty case, use `! $args <: .` — the `.` (dot) matches an empty/absent node. See `structure/server-fn-validation.grit` for an example.

### Regexes Are Anchored

A Grit regex must match the **entire** node's text, not a substring. `$program <: r"react-native"` never matches; `$program <: r"(?s).*react-native.*"` does.

The corollary matters more than the rule: a `(?s).*X.*` pattern used inside `contains` matches **every enclosing node** whose text contains `X` — the string literal, the JSX attribute, the element, the return statement, the function. That produces a pile of duplicate diagnostics on nonsense spans. When matching a string literal, anchor to the literal itself (`r"\"[^\"]*X[^\"]*\""`) and reserve the `.*`-wrapped form for whole-file matches against `$program`.

### `or` Reports Only the First Matching Arm

Within one rule, `or { … }` stops at the first arm that matches a given node, so a node violating three arms produces one diagnostic. `any { … }` continues past a failed arm to try the rest, which is what you want when arms are alternatives that should each get a chance — but it still yields one diagnostic per node per pass.

If a single node genuinely needs several simultaneous diagnostics (a `className` carrying three different off-token classes), split the arms into separate `.grit` plugin files. Biome evaluates each plugin independently.

### Backslash Escapes Corrupt Diagnostic Messages

Do **not** write `\"` inside a `register_diagnostic` message. The escape handling desyncs after the first one: the rest of the message is emitted with `t` rendered as a tab, `n` as a newline, and the closing `\"` printed literally. The message becomes unreadable, and nothing warns you — the rule still fires, so a smoke test that only checks "did the diagnostic appear" passes.

Use single quotes or backticks for quoting inside messages: ``"Use `<Box as='nav'>` instead."`` Read at least one rendered message end to end when smoke testing.

### No Per-File Counting

GritQL per-file rules cannot aggregate or count matches within a file. Rules that need counting (hook-count, prop-count, file-size) must be structural scripts.

---

## Adding a New GritQL Rule

1. Read the relevant rule template from `rules/<tag>/<name>.grit`
2. Adapt paths and patterns to the project's directory structure (the template's "Adapt" section explains what to customize)
3. Write the adapted rule to `biome/<tag>/<name>.grit`
4. Add the plugin path to `biome.json`'s `plugins` array
5. Smoke test (see below)
6. Run `bun run check:arch` to verify no false positives on existing code

## Adding a New Structural Check

1. Read the relevant rule template from `rules/<tag>/<name>.md`
2. Implement as an inline function or delegated TypeScript script
3. Wire it into the orchestrator: return errors for blocking findings and warnings for non-blocking ones, each tied to its file (so warnings can be staged-scoped)
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
