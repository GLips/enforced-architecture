# Enforcement Implementation

How to wire up the enforcement infrastructure. This covers the setup patterns — not the rules themselves (those live in [rules/](rules/overview.md)).

---

## Biome Configuration

Biome loads GritQL rules as plugins. Each `.grit` file in the project's `biome/` directory becomes a lint rule.

Key configuration points:
- Each plugin is an explicit path to a `.grit` file. Biome does not auto-discover plugins — every rule must be listed.
- `files.includes` scopes linting to `src/` and excludes generated files.
- `overrides` can disable plugins for config files (e.g., `vite.config.ts`) that legitimately import server-only packages.
- Organize rules in subdirectories by tag: `biome/boundary/db-isolation.grit`, `biome/api/feature-public-api.grit`, `biome/structure/schema-placement.grit`, etc.

---

## Structural Script Orchestration

An orchestrator script runs all structural checks. Each check is a function that returns its findings — errors (blocking) and warnings (non-blocking).

**Orchestration pattern:**
- Each check runs independently; every finding is tied to the file it concerns.
- The orchestrator reports every error, reports the warnings that survive scoping (below), and counts both.
- Exit code 1 if any errors. Exit code 0 if only warnings or clean.

**One process, one exit code. Never a shell chain.** `check-a && check-b && check-c` stops at the first non-zero exit, so a tree with four violations reports one, you fix it, and the next appears — four round trips where there should be one, and worst exactly when the tree is in the worst shape.

The same trap catches the tiers *above* the orchestrator, and it is easy to fix the scripts and leave it in place one level up. Watch two:

- `check:arch` written as `biome check && check:structure` lets a lint failure hide every structural finding.
- `typecheck` written as `tsc --noEmit && tsc --noEmit -p scripts` lets an app type error hide every error in the check scripts themselves.

Run each independently and aggregate. Reserve `&&` for steps where the second genuinely cannot run after the first fails.

### The shared library

Structural checks share more than a file walker, and duplicating it across scripts guarantees they drift apart on exclusions and on what counts as an import. One `lib.ts` owns:

- **File collection**, with the global test/generated exclusions applied once.
- **The `Finding` / `CheckResult` shape** — `{ message, file? }` and `{ name, errors, warnings }` — which is what lets warnings be staged-scoped at all.
- **The resolved import graph.** Extract imports from the **TypeScript AST, not line regexes.** Every check that asks where an import *lands* consumes this rather than matching how the specifier is *spelled*. See [rules/graph/import-graph.md](rules/graph/import-graph.md) — it is the single most load-bearing piece of the structural tier, and four catalog rules are consumers of it.

Line regexes lose multi-line re-exports, `require()`, computed and quoted keys, and arrow-function declarations, and each loss is silent. Centralising the *same* regexes into a shared file reduces duplication and fixes no correctness — do the AST move at the same time or the shared library is only tidier, not better.

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

Use lefthook (or husky, lint-staged, etc.) for two kinds of commit-time work — keep them distinct, because they have opposite shapes:

- **Format & re-stage** (`biome check --write --linter-enabled=false`) — *mutates* the staged files to apply formatting and import sorting, then re-stages the result. The only writer, so it runs alone and first.
- **Verify** — read-only gates that block the commit and parallelize freely among themselves: Biome lint (the GritQL rules), the structural checks, type checking, and tests. Target latency: under 15 seconds.

**Order the writer ahead of the readers.** A writer sharing a parallel group with readers races them: typecheck and tests read files mid-rewrite, so the run describes content that never reaches the commit — green or red at random, and not reproducible. lefthook's `parallel` is a single hook-level switch, so a `commands:` block is all-sequential or all-concurrent. The `jobs:` array expresses both at once: it preserves order, and a `group:` runs its members in parallel.

```yaml
pre-commit:
  jobs:
    - name: format
      glob: "*.{ts,tsx,js,jsx,json,css}"
      run: bunx biome check --write --linter-enabled=false --no-errors-on-unmatched {staged_files}
      stage_fixed: true
    - name: gate
      group:
        parallel: true
        jobs:
          - name: lint
            glob: "*.{ts,tsx,js,jsx,json,css}"
            run: bunx biome lint --no-errors-on-unmatched {staged_files}
          - name: structure
            run: STAGED_FILES="$(git diff --cached --name-only --diff-filter=ACMR)" bun run check:structure
          - name: typecheck
            run: bun run typecheck
          - name: test
            run: bun run test
```

**Format must `--write` and re-stage — a lint-only hook is the trap.** If the hook only verifies and never writes, formatting is never enforced at commit: unformatted code lands, then the drift surfaces later when someone runs `biome check --write` by hand and it reformats files from *earlier* commits, sweeping unrelated changes into the diff. Make the formatter part of the commit — and disable the linter on this step (`--linter-enabled=false`) so the lint/GritQL pass runs once, in the `lint` job, not here too (`--write` still applies formatting and import sorting).

**Re-stage with `stage_fixed`, never `git add`.** `stage_fixed: true` re-stages only what the command rewrote. `git add {staged_files}` re-stages whole files, silently completing a deliberately partial `git add -p` — the diff the author reviewed is not the diff they committed.

**Monorepo: give it a root Biome config.** A monorepo should ~always have a root `biome.json` plus Biome as a root dependency. Without them there's no single Biome to run from the repo root and nothing telling it the per-workspace plugins, so `bunx biome` at the root pulls a *stray* version that fails to parse the config. Biome 2.x has native monorepo support: the root config is authoritative and each nested workspace `biome.json` adds `"root": false`, so one format command at the root covers every workspace. Stuck with per-workspace-only installs? Fall back to running the format step once per workspace via lefthook's `root:`, which scopes `{staged_files}` to that subtree, relativizes the paths, and runs from that dir so `bunx biome` resolves the workspace-local version and nearest `biome.json`.

**Lint and structure are separate jobs here.** `check:arch` chains them for CI and manual runs, but at pre-commit they scope differently — lint to the staged files, structural repo-wide (see Tier 2 in [enforcement-strategy.md](enforcement-strategy.md)) — so the hook calls each half directly.

**Passing the staged set.** The `STAGED_FILES` assignment on `structure` above is what lets the orchestrator scope its warnings (see Structural Script Orchestration). Compute that set from git in the command itself rather than the pre-commit tool's file template. The orchestrator only reads `STAGED_FILES`, so it stays agnostic to the pre-commit tool. `--diff-filter=ACMR` lists added/copied/modified/renamed paths (skipping deletions). The whole newline-separated list lands in one env value via `$(…)`.

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

    $program <: contains bubble or {
        JsModuleSource() as $source,
        `import($source)`
    } where {
        $source <: r"\"@/features.*\"",
        register_diagnostic(span = $source, message = "…")
    }
}
```

`JsModuleSource` is the node every *static* import and re-export shares, so one pattern covers all of them: any number of named specifiers, default, namespace (`import * as x`), combined (`import def, { x }`), side-effect (`import "x"`), multi-line, and `export { x } from "…"`. A plain string that happens to contain the same path is *not* a module source, so it does not match.

A dynamic `import("…")` is a call expression, not a module source, so `JsModuleSource` does **not** see it. That is the second arm's whole job. Keep it on every containment rule — a rule that says "this module is unreachable from here" is false the moment `await import()` gets past it, and the bypass is one keystroke away from anyone who hits the error.

The node's text includes its quotes, and Grit regexes are anchored, so write `r"\"@/features.*\""` — or `r".*['\"]@/features.*['\"].*"` if you prefer to be explicit about both quote styles. The same regex serves both arms: `$source` is the quoted string either way.

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
5. Write its three fixtures (see below) — the adversarial one decides whether the rule works
6. Run `bun run check:arch` to verify no false positives on existing code

## Adding a New Structural Check

1. Read the relevant rule template from `rules/<tag>/<name>.md`
2. Implement as a function returning findings, using the shared library (below) for file collection and import resolution
3. Wire it into the orchestrator: return errors for blocking findings and warnings for non-blocking ones, each tied to its file (so warnings can be staged-scoped)
4. Write its three fixtures (see below)
5. Run `bun run check:arch` to verify

---

## Rule Fixtures

**Fixtures are permanent and they run in CI.** A rule is code with exactly one job, and its failure mode is silent by construction: a rule that stops matching does not error, it goes green. Enforcement code needs regression tests more than application code does, because application code has users who notice.

Do not smoke test once and delete the fixture. That is the single practice that produces broken rules at scale — it has now been observed to yield fifteen ungoverned invariants across four repositories, every one of them behind a green check. The deleted fixture takes the evidence with it and leaves a rule nobody can distinguish from a working one.

### The fixture set per rule

Three cases, not one:

1. **The obvious violation** — the shape named in the rule's own description.
2. **The adversarial violation** — the same violation written the way the rule's natural pattern *misses*. This is the case that matters, and it is the one an author writing their own fixture will not think of, because a fixture written by the rule's author encodes the rule's assumptions.
3. **The legal neighbour** — code that looks like the violation and is allowed. This is what catches over-matching, which no positive fixture reveals. A rule that fires on `{ message: "#fff is white" }` passes every colour fixture ever written.

The suite asserts each rule produced *exactly* the expected diagnostics. `biome lint --reporter=json` gives rule name and span; structural scripts are matched on their `FAIL [name] path:line` lines.

Keep the fixture tree outside the source root so the architecture rules do not govern it — a fixture is deliberately illegal code. One narrow excluded path, not a list that grows.

### Adversarial checklist

Every entry below has broken a real rule that had passed its own smoke test. Write the fixture even when you are confident:

| Axis | The shape that gets past |
|---|---|
| Import clause arity | `import { a, b } from "m"` where the fixture used `{ a }` — see *Matching Imports in GritQL* |
| Declaration form | `export default function`, an arrow assigned to a `const`, and a declaration exported on a later line |
| Quote style | `import x from 'pkg'` where the regex anchored on `\"` only |
| Re-export | `export { x } from "pkg"` and `export * from "pkg"`, which carry a runtime dependency exactly like an import |
| Type-only spelling | `import { type X }` reported by a rule that exempts only statement-level `import type` |
| Path depth | `../../service/x` from a nested directory where the pattern assumed one `../` |
| Alias spelling | `@/features/self/controllers/x` for a rule matching only relative paths, and vice versa |
| Package subpath | `pkg/lib/thing` where the rule matched bare `pkg` |
| Dynamic import | `await import("…")`, which `JsModuleSource` does not see |
| Indirect member access | `process["env"].X`, `globalThis.process.env.X`, `React.useEffect` |
| Non-static edge | `require("…")` and side-effect `import "…"` where the extractor only handled `from` |
| Literal form | a template literal where the pattern matched quoted strings |
| Multi-line | a re-export or type body spanning lines where the check reads one line at a time |
| Spread and shorthand | `style={[base, {…}]}`, `{ fontSize }`, a computed key |

### Where fixtures fit the pipeline

The fixture suite runs inside `check:arch`, so a broken rule fails the same gate a broken boundary does. When a rule is known-broken and not yet repaired, land its fixture failing rather than omitting it — that is what makes the backlog visible instead of theoretical.
