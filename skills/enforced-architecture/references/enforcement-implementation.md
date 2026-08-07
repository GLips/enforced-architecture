# Enforcement Implementation

How to wire up the enforcement infrastructure. This covers the setup patterns — not the rules themselves (those live in [rules/](rules/overview.md)).

---

## oxlint Configuration

Per-file rules are oxlint JS plugins: one `.ts` file per rule, every rule registered in **one** plugin module, that module named in `.oxlintrc.json`.

```jsonc
{
  // .oxlintrc.json is JSONC, so the config carries its own rationale.
  "jsPlugins": ["./oxlint/plugin.ts"],
  "ignorePatterns": ["src/gen/**"],
  "rules": {
    "arch/db-isolation": "error",
    "arch/shared-ui-purity": "error"
  },
  "overrides": [
    // Config files are not application source; they import server-only packages by design.
    { "files": ["*.config.ts"], "rules": { "arch/db-isolation": "off" } }
  ]
}
```

Key configuration points:

- **One plugin module, not one path per rule.** `jsPlugins` lists modules; each module's `definePlugin({ meta: { name }, rules })` maps a key to a rule. Keep the rule files organized by tag on disk (`oxlint/boundary/db-isolation.ts`, `oxlint/api/feature-public-api.ts`) and keep each key equal to its file name, so the diagnostic id is also the path to the rule that raised it: `error arch(db-isolation): …`. `meta.name` is the prefix every key inherits.
- **Registration and activation are separate, and only one of them fails loudly.** A rule the plugin exports but `rules` never names is loaded and never run — no warning, no output, exit 0. A `rules` key naming a rule the plugin does *not* export is fatal (`Rule 'x' not found in plugin 'arch'`). The typo is caught; the omission is not, which is why the spec harness fails a rule missing from the plugin module.
- **Scope by path argument.** `oxlint src` lints the source root. Generated trees come out via `ignorePatterns` in the config, `--ignore-pattern`, or an `.eslintignore`.
- **`overrides` disables a rule for files that are legitimately outside the architecture** — `vite.config.ts`, `drizzle.config.ts`, anything at the repo root that imports server-only packages. Reach for an override when the exception is *this project's*; put it in the rule's own path exemptions when it is an architectural fact every project inherits (`db-isolation` exempts the ORM config file itself for that reason).
- **Suppression is per rule and position-sensitive.** `// oxlint-disable-next-line arch/db-isolation` suppresses a JS-plugin diagnostic. Some built-in rules only honour the comment above a specific line — `react-hooks/exhaustive-deps` wants it above the *dependency array*, not above the hook call. Probe placement rather than assuming it.

Rules share a `lib/`, and the sharing is load-bearing rather than tidy: [lib/architecture-exempt-paths.ts](rules/lib/architecture-exempt-paths.ts) owns the one global test/script exemption, [lib/module-source-visitor.ts](rules/lib/module-source-visitor.ts) owns every place a module specifier can appear, [lib/range-index.ts](rules/lib/range-index.ts) answers subtree questions at `Program:exit`, and [lib/rule-spec.ts](rules/lib/rule-spec.ts) owns the three-kind spec contract. One module owns each, so a new rule inherits the fix rather than a copy of the bug.

**oxlint's JS plugins are alpha** as of 1.77 and say so. The API is ESLint's `create(context)` returning a visitor, so the exposure is churn in a young API, not a design bet.

---

## Structural Script Orchestration

An orchestrator script runs all structural checks. Each check is a function that returns its findings — errors (blocking) and warnings (non-blocking).

**Orchestration pattern:**
- Each check runs independently; every finding is tied to the file it concerns.
- The orchestrator reports every error, reports the warnings that survive scoping (below), and counts both.
- Exit code 1 if any errors. Exit code 0 if only warnings or clean.

**One process, one exit code. Never a shell chain.** `check-a && check-b && check-c` stops at the first non-zero exit, so a tree with four violations reports one, you fix it, and the next appears — four round trips where there should be one, and worst exactly when the tree is in the worst shape.

The same trap catches the tiers *above* the orchestrator, and it is easy to fix the scripts and leave it in place one level up. Watch two:

- `check:arch` written as `oxlint src && check:structure` lets a lint failure hide every structural finding.
- `typecheck` written as `tsc --noEmit && tsc --noEmit -p scripts` lets an app type error hide every error in the check scripts themselves.

Run each independently and aggregate. Reserve `&&` for steps where the second genuinely cannot run after the first fails.

### The substrate

Structural checks ship with the modules they share, and the sharing is the point: duplicated across scripts, they drift apart on exclusions and on what counts as an import, without either copy reporting that it has.

- **`config.ts`** — every per-repo value for every check, one object. The adoption surface.
- **`lib.ts`** — file collection with the global exclusions applied once, plus the `Finding` and `StructuralCheck` shapes. A finding carries its own `severity` and `file`, which is what makes staged scoping possible at all.
- **`import-graph.ts`** — the resolved graph, and `scanDeclaredImports` for the one check that needs raw specifiers instead. Any check asking where an import *lands* consumes this rather than matching how the specifier is spelled.
- **`run-structural-checks.ts`** — the orchestrator.

Centralising the *same* patterns into a shared file reduces duplication and fixes no correctness. Reach for the reader at the same time, or the shared library is only tidier, not better.

**`Bun.Transpiler` answers questions about imports and exports, and nothing else.** It exposes import paths and kinds, export names, and transformed JavaScript — not component boundaries, call expressions, parameter structure, or TypeScript property signatures, and `transform()` erases the very annotations `prop-count` needs. So it retires the extraction patterns and no others. The counting checks legitimately stay on patterns, guarded by adversarial cases: what they need is a *count per component or per file*, which the reader does not aggregate. If their heuristics ever get too expensive to maintain, the precise alternative is the TypeScript compiler AST — not another `Bun.Transpiler` method.

### Staged-scoped warnings

At pre-commit, advisory warnings scope to the files the commit touches; blocking errors always surface repo-wide (rationale in [enforcement-strategy.md](enforcement-strategy.md) under Tier 2). Two things make it work:

- **Every finding carries its file as structured data**, not a path buried in a message string. This is why checks *return* findings rather than printing as they go — a line already written to stdout cannot be filtered.
- **The staged set is injected, not discovered.** The orchestrator reads `STAGED_FILES` and stays agnostic to which pre-commit tool produced it. Unset means no filter, so CI and manual runs warn repo-wide. A finding with no file is kept rather than hidden — it cannot be matched, and dropping it would make scoping silently lossy.

---

## Pre-commit Configuration

Use lefthook (or husky, lint-staged, etc.) for two kinds of commit-time work — keep them distinct, because they have opposite shapes:

- **Format & re-stage** — *mutates* the staged files, then re-stages the result. The only writer, so it runs alone and first.
- **Verify** — read-only gates that block the commit and parallelize freely among themselves: `oxlint` (the JS-plugin rules), the structural checks, type checking, and tests. Target latency: under 15 seconds.

**oxlint is a linter only, and nothing in this stack sorts imports.** `oxfmt` formats and does not sort, and oxlint has no organize-imports rule, so a project either accepts unsorted imports or picks a formatter that sorts. The format step below is whichever tool it chose; what matters architecturally is that there is exactly one writer and it runs first.

**Order the writer ahead of the readers.** A writer sharing a parallel group with readers races them: typecheck and tests read files mid-rewrite, so the run describes content that never reaches the commit — green or red at random, and not reproducible. lefthook's `parallel` is a single hook-level switch, so a `commands:` block is all-sequential or all-concurrent. The `jobs:` array expresses both at once: it preserves order, and a `group:` runs its members in parallel.

```yaml
pre-commit:
  jobs:
    - name: format
      glob: "*.{ts,tsx,js,jsx,json,css}"
      run: bunx prettier --write --ignore-unknown {staged_files}
      stage_fixed: true
    - name: gate
      group:
        parallel: true
        jobs:
          - name: lint
            glob: "*.{ts,tsx,js,jsx}"
            run: bunx oxlint --no-error-on-unmatched-pattern {staged_files}
          - name: structure
            run: STAGED_FILES="$(git diff --cached --name-only --diff-filter=ACMR)" bun run check:structure
          - name: typecheck
            run: bun run typecheck
          - name: test
            run: bun run test
```

**Format must write and re-stage — a check-only hook is the trap.** If the hook only verifies and never writes, formatting is never enforced at commit: unformatted code lands, then the drift surfaces later when someone runs the formatter by hand and it reformats files from *earlier* commits, sweeping unrelated changes into the diff. Make the formatter part of the commit. The formatter and the linter are separate binaries now, so there is no way for the format step to run the rules a second time — one fewer thing to disable, and the only remaining requirement is that this step writes.

**Re-stage with `stage_fixed`, never `git add`.** `stage_fixed: true` re-stages only what the command rewrote. `git add {staged_files}` re-stages whole files, silently completing a deliberately partial `git add -p` — the diff the author reviewed is not the diff they committed.

**Monorepo: give it a root config and a root install.** A monorepo should ~always have a root `.oxlintrc.json` plus oxlint as a root dependency. Without them there is no single oxlint to run from the repo root and nothing telling it where the plugin module lives, so `bunx oxlint` pulls a stray version that lints with none of the architecture rules loaded — a green run that checked nothing. oxlint loads nested config files automatically (`--disable-nested-config` turns that off), so a workspace that needs its own rule set gets its own `.oxlintrc.json`. For the format step, a formatter installed per workspace only is run once per workspace via lefthook's `root:`, which scopes `{staged_files}` to that subtree, relativizes the paths, and runs from that dir so `bunx` resolves the workspace-local version.

**Lint and structure are separate jobs here.** `check:arch` runs and aggregates both for CI and manual use, but at pre-commit they scope differently — lint to staged files, structural checks repo-wide — so the hook calls each half directly.

**Passing the staged set.** The `STAGED_FILES` assignment on `structure` above is what lets the orchestrator scope its warnings (see Structural Script Orchestration). Compute that set from git in the command itself rather than the pre-commit tool's file template. The orchestrator only reads `STAGED_FILES`, so it stays agnostic to the pre-commit tool. `--diff-filter=ACMR` lists added/copied/modified/renamed paths (skipping deletions). The whole newline-separated list lands in one env value via `$(…)`.

**Gotcha — don't use the tool's file template inline.** It's tempting to write `STAGED_FILES="{staged_files}"` (lefthook) or the husky/lint-staged equivalent. It breaks: these templates quote each path individually, and a quoted list can't be the right-hand side of an env-var assignment — `ENV="a" "b" cmd` sets `ENV=a` and runs `b` as a command (exit 126, "permission denied"). File templates are built to be a command's *arguments*, not an env value. Computing the set from git sidesteps the quoting entirely.

---

## Package.json Scripts

Three architecture-specific scripts:
- `check:arch` — runs `oxlint` and the structural checks **independently** and aggregates, so a lint failure cannot hide every structural finding (see *One process, one exit code* above). This is the single command that verifies all architectural constraints.
- `check:structure` — runs only structural checks. Useful when iterating on script changes without re-running lint.
- `check:rules` — runs the rule specs, through the real-Node launcher. **`RuleTester` does not run under Bun.** It parses in Rust and shares the AST by zero-copy raw transfer, which needs an `ArrayBuffer` JavaScriptCore cannot allocate, so oxlint refuses Bun by name and offers no slower fallback. Worse, Bun puts a `node`-named symlink to *itself* on PATH ahead of the real binary for every process it spawns, so in a Bun-spawned shell — which is where agents run — a bare `node --test` is Bun wearing node's name and every spec dies with `Cannot use describe outside of the test runner`. That names the test framework and points nowhere near the cause, so a working gate reads as a broken suite and invites `--no-verify`. One launcher per repo strips the `/bun-node-` entries from PATH and `exec node "$@"`. A project on Bun also needs `bun test --path-ignore-patterns='**/oxlint/**'`, or `bun test` picks the specs up and throws on every case. The `oxlint` CLI itself is fine under Bun; this binds only the rule-authoring path.

---

## Framework Import Protection

SSR frameworks with server/client bundle splitting (TanStack Start, Next.js, SolidStart) offer import protection configuration. This is a complementary defense layer — it catches server-only imports at dev/build time.

Configure two lists:
- **`client.specifiers`** — import paths denied from client bundles (e.g., `@/infrastructure/db/**`, `@/env.server`)
- **`client.files`** — file patterns denied from client bundles (e.g., `**/*.server.*`, `src/infrastructure/db/**`)

When adding a new server-only infrastructure module, add it to both lists. When adding a client-safe infrastructure module, skip the deny lists and update the infrastructure client boundary rule's allowlist.

---

## Matching Imports in a Visitor

Most rules in the catalog are import rules, and they all match imports the same way. Follow this shape.

### When the rule only cares about the module

Go through [lib/module-source-visitor.ts](rules/lib/module-source-visitor.ts). It hands back a visitor covering every place a module specifier appears, and the rule supplies one callback:

```ts
const DB_SPECIFIER = /^@\/infrastructure\/db(?:\/|$)/;

return visitModuleSources((source, specifier) => {
  if (DB_SPECIFIER.test(specifier)) {
    context.report({ node: source, messageId: "dbOutsideDataLayer" });
  }
});
```

A hand-rolled `ImportDeclaration` visitor is the natural thing to write, and it covers one of the four places a specifier appears. What it misses:

- `export { db } from "@/infrastructure/db"` — an `ExportNamedDeclaration` with a non-null `source`. It carries the same runtime dependency an import does.
- `export * from "…"` — an `ExportAllDeclaration`, which names no binding for a reviewer to notice either.
- `await import("…")` — an `ImportExpression`. A rule that says "this module is unreachable from here" is false the moment a dynamic import gets past it, and that bypass is one keystroke away from anyone who hits the error.

The specifier arrives as a plain string (`node.source.value`), without quotes, so the test is an ordinary anchored regex and quote style is not an axis. A string literal that merely contains the same path is not a module source and never reaches the callback. Report on the `source` node so the span lands on the specifier rather than the whole statement.

A *computed* specifier — ``import(path)``, ``import(`${base}/db`)`` — has nothing to fence on, so the visitor skips it. That is deliberate negative space, not a gap to patch.

### When the rule cares which names were imported

The names are on the `ImportDeclaration` node itself. Loop its `specifiers`:

```ts
const BANNED_COMPONENTS = new Set(["Textarea"]);

return {
  ImportDeclaration(node) {
    if (node.source.value !== "@mantine/core") return;
    if (node.importKind === "type") return;
    for (const specifier of node.specifiers) {
      if (specifier.type !== "ImportSpecifier") continue;
      if (specifier.importKind === "type") continue;
      if (BANNED_COMPONENTS.has(specifier.imported.name)) {
        context.report({ node: specifier, messageId: "bannedComponent" });
      }
    }
  },
};
```

Three details carry the weight:

- **Every specifier is tested, because it is a loop.** `import { Button, Textarea }` reports `Textarea`. A rule that reads `node.specifiers[0]` instead passes that import silently — the second name in a clause is the cheapest thing in this catalog to miss.
- **`imported` is the exported name, `local` is the binding.** `{ Textarea as TA }` is one `ImportSpecifier` with `imported.name === "Textarea"` and `local.name === "TA"` — match on `imported` for a rule about the package's API, on `local` for a rule about what this file calls. Default and namespace clauses are `ImportDefaultSpecifier` and `ImportNamespaceSpecifier`, and carry only `local`.
- **Type-only is two flags, not one.** `import type { X }` sets `importKind: "type"` on the *declaration*; `import { type X }` sets it on the *specifier* — and the specifiers of a type-only declaration each report `"value"`, so a rule that checks one level and not the other lets the other spelling through. A type import pulls in no runtime value, which is why most rules exempt it; a rule about coupling rather than about the bundle does not — `boundary/db-isolation` reports `import type { Invoice } from "@/infrastructure/db/schema/…"`, because knowing the schema's shape is the dependency it exists to prevent.

Comparing against a `Set` of exact names is exact by construction, so `TextareaProps` cannot match. Reach for a regex only when the name has real shape to it, and anchor it end to end.

---

## Where a Visitor Fails Silently

There are three, and they are all the same shape: the rule does nothing, and nothing says so.

### A Typo'd Visitor Key Never Fires

`create` returning `{ ImportDeclaraton(node) { … } }` loads clean, runs, reports nothing, and exits 0. Visitor keys are not validated against the node types — an unknown key is simply a key nothing visits. There is no load error, no warning, and no output to be suspicious of, and the result is indistinguishable from a codebase with no violations.

This is why per-rule specs are not optional. It is the whole failure mode of the tier in one line: enforcement code that stops enforcing goes green, not red. Note the asymmetry with the config — the *same* typo in `.oxlintrc.json` is fatal, because a rule key must resolve to a rule the plugin exports. The half that is checked is the half that does not matter.

### A Parent Is Visited Before Its Children

The walk is depth-first and pre-order: for `const f = () => { g(h()); }` the arrow function arrives first, then `g(…)`, then `h()`. So no visitor can answer "does this subtree contain X" at the moment it sees the enclosing node — the children have not happened yet.

Any rule shaped as a claim about a subtree — a `useEffect` callback that contains a `setState` but no `await`, a conditional chain nested three deep — records what it sees as it goes and decides at `"Program:exit"`. [lib/range-index.ts](rules/lib/range-index.ts) is that pattern factored out: tag a range on the way past, ask `containedIn` afterwards. Writing the subtree walk by hand per rule works and costs a bespoke walker per rule; asking a range index costs one array per tag.

### A Rule Sees One File

A rule instance is created per file and knows nothing about any other. It cannot resolve a specifier to the file it lands in, ask whether a directory exists, or aggregate across a file set. Everything of that shape is a structural script: cycles, coupling, transitive barrel purity, and the depth-dependent question of whether `../../beta` leaves the current feature.

Within a file, `Program:exit` does aggregate: `health/no-nested-ternary` uses it to compute the depth of every conditional. Which mechanism each rule runs on is in [rules/overview.md](rules/overview.md).

---

## Adding a New Rule

1. Read the relevant rule template from `rules/<tag>/<name>.ts` and the spec beside it, `rules/<tag>/<name>.test.ts`
2. Copy both into the project (`oxlint/<tag>/`) and adapt the named constants at the top of the rule — the template's "Adapt" section explains which ones and what the alternatives are. The constants are hoisted and named precisely so adaptation is an edit to a regex or a list, not a rewrite of the visitor
3. Register it in the project's plugin module: import the rule and add it to `rules` under its file name
4. Switch it on in `.oxlintrc.json` (`"<plugin>/<name>": "error"`). Registered but unlisted is loaded and never run
5. Write the three-kind spec (see below) — the adversarial cases decide whether the rule works
6. Run the spec under **real Node**, through the launcher. Under Bun the specs die with an error that names the test framework and not the runtime (see *Package.json Scripts*)
7. Revert-probe it: misspell the visitor key or invert a guard and watch the adversarial kind fail; break the exemption and watch the legal kind fail; restore both. A spec that stays green through that is asserting nothing
8. Run `bun run check:arch` against the real tree. A hit is either a false positive (narrow the rule) or a true violation — and true violations are the rollout: sweep them in the same change the rule lands in. A rule that ships alongside its own open violations either blocks everyone or teaches everyone to ignore it

## Adopting a Structural Check

Not "implementing" — the checks in the catalog are runnable modules, proved against fixtures in the skill's own CI. Reimplementing one from its doc is how a check ends up silently matching less than the doc promises, which is what happened at three separate deployments before this tier shipped as code.

1. Copy `rules/scripts/{config,lib,import-graph,run-structural-checks}.ts` into the project's `scripts/`, plus each selected `rules/<tag>/<name>.ts`
2. Register the checks in the project's `scripts/registry.ts`. A check that is not registered is a file that ships and never runs
3. Write `arch.config.ts`: spread `defaultCheckConfigs` and override what differs. Read each rule's **Adapt** section for its keys — that section names them because the config object is the entire adoption surface
4. Run once against the real tree and calibrate any thresholds *just above* current values, so they signal growth rather than firing on day one. A check that fires on the state of the world the day it was installed is a check that gets switched off in the same week
5. Write the project's three cases (see below) against its own code. The catalog's fixtures prove the check; yours prove the config
6. Run `bun run check:arch` to verify

## Adding a Genuinely New Structural Check

When no catalog rule covers the invariant:

1. Export a `StructuralCheck` — an `id` and a `run(context)` that **returns findings**. The orchestrator owns reporting and the exit code, which is what lets warnings be staged-scoped and lets one check throw without silencing the rest
2. Take imports from `context.importGraph()` and file sets from the shared collection helpers. Do not scan files for imports directly: the union of Bun's two scans and the JSX-runtime filter are where the silent losses live
3. Put every per-repo value in the config object, never as a constant in the check body. The test is whether a second project could adopt it by writing config alone
4. Write its three cases (see below), then revert-probe: disable the matcher and watch the adversarial case report as missed

---

## Rule Specs

**Specs are permanent and they run in CI.** A rule is code with exactly one job, and its failure mode is silent by construction: a rule that stops matching does not error, it goes green. Enforcement code needs regression tests more than application code does, because application code has users who notice.

Every rule in the catalog ships its spec beside it, and the spec imports the rule file directly — one artifact, no second copy to drift. Keep them permanent.

### The case set per rule

Three kinds, not one. `describeRule` takes them as named arguments and throws on an empty list, so a missing kind is a failure rather than a convention nobody checks:

1. **The obvious violation** — the shape named in the rule's own description.
2. **The adversarial violation** — the same violation written the way the rule's natural pattern *misses*. This is the case that matters, and it is the one an author writing their own spec will not think of, because a spec written by the rule's author encodes the rule's assumptions.
3. **The legal neighbour** — code that looks like the violation and is allowed. This is what catches over-matching, which no positive case reveals. A rule that fires on `{ message: "#fff is white" }` passes every colour case ever written.

Each invalid case asserts the diagnostics **exactly** — the count as well as the message id — so a missing diagnostic (a dead branch) and a duplicate on an expected line (an over-match) both fail. The expectation lives on the case, so extending a case extends its expectation with it.

**Every case carries its own `filename`, at a full realistic path** in the standard layout (`/repo/src/features/billing/service/charge.ts`), because the rules read the path: a path-guarded rule checked against a bare basename passes vacuously. A rule's by-path exemption gets its own legal case — the exempted file carrying the leak spelling verbatim, expected to draw nothing — and its own adversarial case for the near-miss the exemption must *not* cover (`legacy-repo/` is not `repo/`).

### Adversarial checklist

Write the case even when you are confident:

| Axis | The shape that gets past |
|---|---|
| Import clause arity | `import { a, b } from "m"` where the rule tested only the first specifier — see *Matching Imports in a Visitor* |
| Declaration form | `export default function`, an arrow assigned to a `const`, and a declaration exported on a later line |
| Re-export | `export { x } from "pkg"` and `export * from "pkg"`, which carry a runtime dependency exactly like an import |
| Type-only spelling | `import { type X }` reported by a rule that only checks `importKind` on the declaration |
| Path depth | `../../service/x` from a nested directory where the pattern assumed one `../` |
| Alias spelling | `@/features/self/controllers/x` for a rule matching only relative paths, and vice versa |
| Segment boundary | `legacy-repo/` matching a `repo/` exemption, `@/features-legacy` matching `@/features` — anchor on `/src/` and on the separator |
| Package subpath | `pkg/lib/thing` where the rule matched bare `pkg` |
| Dynamic import | `await import("…")`, which an `ImportDeclaration` visitor does not see |
| Indirect member access | `process["env"].X`, `globalThis.process.env.X`, `React.useEffect` |
| Non-static edge | `require("…")` and side-effect `import "…"` where the extractor only handled `from` |
| Literal form | a template literal where the check matched quoted strings — and ``import(`${base}/db`)``, which nothing can fence |
| Multi-line | a re-export or type body spanning lines where a script reads one line at a time |
| Spread and shorthand | `style={[base, {…}]}`, `{ fontSize }`, a computed key |

### Mutate once to prove the harness

The harness is enforcement code with the same silent failure mode as the rules it guards. After writing a rule's spec — and after any harness change — break the rule (misspell the visitor key, invert a guard) and expect the adversarial kind to fail; break its exemption and expect the legal kind to fail; restore both. A harness that stays green through both mutations is not testing anything.

### Where the specs fit the pipeline

The spec suite runs inside `check:arch`, so a broken rule fails the same gate a broken boundary does. When a rule is known-broken and not yet repaired, land its spec failing rather than omitting it — that is what makes the backlog visible instead of theoretical.

Beyond the specs themselves, the runner checks the three things a spec cannot say about itself, each of which leaves a green run behind a rule nothing exercises: a rule with no spec beside it, a spec pointed at a different rule than the one it sits next to, and a rule missing from the plugin module — tested, and never loaded.
