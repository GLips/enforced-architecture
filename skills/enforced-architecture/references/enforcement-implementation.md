# Enforcement Implementation

How to wire up the enforcement infrastructure. Not the rules themselves — those live in [rules/](rules/overview.md).

Three of the five config artifacts ship as commented files. Copy them and read the comments in place; the gotchas live on the lines they govern. `jscpd.json` is the one that cannot carry its own: jscpd parses it as strict JSON and dies on the first comment, so its rationale sits under *Package.json Scripts* below.

| Artifact | Copy from | Target |
|---|---|---|
| oxlint config | [setup/oxlintrc.json](setup/oxlintrc.json) | `.oxlintrc.json` (repo root; root of the monorepo) |
| Pre-commit hook | [setup/lefthook.yml](setup/lefthook.yml) | `lefthook.yml` |
| Duplication config | [setup/jscpd.json](setup/jscpd.json) | `.jscpd.json` (repo root) |
| Structural check substrate | `rules/scripts/*.ts` | `scripts/` |
| Framework import protection | [server-client-boundaries.md](server-client-boundaries.md) | `vite.config.ts` |

---

## The oxlint tier

Per-file rules are oxlint JS plugins: one `.ts` file per rule, every rule registered in **one** plugin module, that module named in `.oxlintrc.json`. Organize rule files by tag on disk (`oxlint/boundary/db-isolation.ts`).

Three dev dependencies beyond `oxlint`. `oxlint-tsgolint` backs `options.typeAware`; `eslint-plugin-sonarjs` loads through the same `jsPlugins` array as the architecture rules, so the duplication and identity checks cost one package rather than a second tool. `jscpd` is neither — a separate binary, below. What each buys and what breaks without it is on the lines that switch them on, in [setup/oxlintrc.json](setup/oxlintrc.json).

Rules share a `lib/`, and the sharing is load-bearing rather than tidy. One module owns each concern, so a new rule inherits the fix rather than a copy of the bug:

- [lib/architecture-exempt-paths.ts](rules/lib/architecture-exempt-paths.ts) — the one global test/script exemption.
- [lib/module-source-visitor.ts](rules/lib/module-source-visitor.ts) — every place a module specifier can appear.
- [lib/range-index.ts](rules/lib/range-index.ts) — subtree questions answered at `Program:exit`.
- [lib/rule-spec.ts](rules/lib/rule-spec.ts) — the three-kind spec contract.

**oxlint's JS plugins are alpha** as of 1.77 and say so. The API is ESLint's `create(context)` returning a visitor, so the exposure is churn in a young API, not a design bet.

---

## Structural Script Orchestration

An orchestrator runs all structural checks. Each check is a function returning findings — errors (blocking) and warnings (non-blocking). The orchestrator reports every error, reports the warnings that survive scoping, counts both, and exits 1 if any errors.

**One process, one exit code. Never a shell chain.** `check-a && check-b && check-c` stops at the first non-zero exit, so a tree with four violations reports one, you fix it, and the next appears — four round trips where there should be one, and worst exactly when the tree is in the worst shape.

The same trap catches the tiers *above* the orchestrator, and it is easy to fix the scripts and leave it in place one level up. Watch two:

- `check:arch` written as `oxlint src && check:structure` lets a lint failure hide every structural finding.
- `typecheck` written as `tsc --noEmit && tsc --noEmit -p scripts` lets an app type error hide every error in the check scripts themselves.

Run each independently and aggregate. Reserve `&&` for steps where the second genuinely cannot run after the first fails.

### The substrate

Structural checks ship with the modules they share, and the sharing is the point: duplicated across scripts, they drift apart on exclusions and on what counts as an import, without either copy reporting that it has.

- **`config.ts`** — every per-repo value for every check, one object. The adoption surface.
- **`lib.ts`** — file collection with the global exclusions applied once, plus the `Finding` and `StructuralCheck` shapes.
- **`import-graph.ts`** — the resolved graph, and `scanDeclaredImports` for the one check that needs raw specifiers instead. Any check asking where an import *lands* consumes this rather than matching how the specifier is spelled.
- **`run-structural-checks.ts`** — the orchestrator.

Centralising the *same* patterns into a shared file reduces duplication and fixes no correctness. Reach for the reader at the same time, or the shared library is only tidier, not better.

**`Bun.Transpiler` answers questions about imports and exports, and nothing else.** It exposes import paths and kinds, export names, and transformed JavaScript — not component boundaries, call expressions, parameter structure, or TypeScript property signatures, and `transform()` erases the very annotations `prop-count` needs. So it retires the extraction patterns and no others. The counting checks legitimately stay on patterns, guarded by adversarial cases: what they need is a *count per component or per file*, which the reader does not aggregate. If their heuristics ever get too expensive to maintain, the precise alternative is the TypeScript compiler AST — not another `Bun.Transpiler` method.

### Staged-scoped warnings

At pre-commit, advisory warnings scope to the files the commit touches; blocking errors always surface repo-wide (rationale in [enforcement-strategy.md](enforcement-strategy.md) under Tier 2). Two design constraints make it possible, and both bind any new check:

- **Every finding carries its file as structured data**, not a path buried in a message string. This is why checks *return* findings rather than printing as they go — a line already written to stdout cannot be filtered.
- **The staged set is injected, not discovered.** The orchestrator reads `STAGED_FILES` and stays agnostic to which pre-commit tool produced it. A finding with no file is kept rather than hidden — it cannot be matched, and dropping it would make scoping silently lossy.

---

## Package.json Scripts

- `check:arch` — runs `oxlint` and the structural checks **independently** and aggregates, so a lint failure cannot hide every structural finding. The single command that verifies all architectural constraints.
- `check:structure` — structural checks only. For iterating on script changes without re-running lint.
- `duplication` — `jscpd --config .jscpd.json src scripts`. A separate binary with its own exit code, not an oxlint plugin, and it runs in CI only ([enforcement-strategy.md](enforcement-strategy.md), Tier 3). 60 tokens / 6 lines, matched on normalized tokens in `mild` mode: renaming every variable does not hide the clone, and neither does inserting a comment or a blank line. `sonarjs/no-identical-functions` in `.oxlintrc.json` catches what fits inside one rule's window; this catches the copy that spans files. Fence repetition that is genuinely irreducible with `/* jscpd:ignore-start */ … /* jscpd:ignore-end */`. Do not raise `minTokens` instead: that hides every clone of that size, not the one you meant to allow.
- `check:rules` — the rule specs, through the real-Node launcher (`harness/with-real-node.sh`, which explains itself). **`RuleTester` does not run under Bun**, and under Bun the specs fail with an error naming the test framework rather than the runtime — so a working gate reads as a broken suite and invites `--no-verify`. A project on Bun also needs `bun test --path-ignore-patterns='**/oxlint/**'`, or `bun test` picks the specs up and throws on every case. The `oxlint` CLI itself is fine under Bun; this binds only the rule-authoring path.

---

## Matching Imports in a Visitor

Most rules in the catalog are import rules. Go through [lib/module-source-visitor.ts](rules/lib/module-source-visitor.ts) — it covers every place a specifier appears and the rule supplies one callback:

```ts
const DB_SPECIFIER = /^@\/infrastructure\/db(?:\/|$)/;

return visitModuleSources((source, specifier) => {
  if (DB_SPECIFIER.test(specifier)) {
    context.report({ node: source, messageId: "dbOutsideDataLayer" });
  }
});
```

A hand-rolled `ImportDeclaration` visitor is the natural thing to write and covers one of the four forms; the module's header names the rest. The specifier arrives as a plain string without quotes, so the test is an ordinary anchored regex — a string literal that merely contains the same path never reaches the callback. Report on the `source` node so the span lands on the specifier.

### When the rule cares which names were imported

No shared module covers this: the names are on the `ImportDeclaration` node, and you loop its `specifiers` yourself. Three details carry the weight.

- **Every specifier is tested, because it is a loop.** `import { Button, Textarea }` reports `Textarea`. A rule reading `node.specifiers[0]` passes that import silently — the second name in a clause is the cheapest thing in this catalog to miss.
- **`imported` is the exported name, `local` is the binding.** `{ Textarea as TA }` is one `ImportSpecifier` with `imported.name === "Textarea"` and `local.name === "TA"` — match on `imported` for a rule about the package's API, on `local` for a rule about what this file calls. Default and namespace clauses carry only `local`.
- **Type-only is two flags, not one.** `import type { X }` sets `importKind: "type"` on the *declaration*; `import { type X }` sets it on the *specifier* — and the specifiers of a type-only declaration each report `"value"`, so a rule checking one level and not the other lets the other spelling through. Most rules exempt type imports because they pull in no runtime value; a rule about coupling rather than about the bundle does not — `boundary/db-isolation` reports `import type { Invoice }` from the schema, because knowing the schema's shape is the dependency it exists to prevent.

Compare against a `Set` of exact names, so `TextareaProps` cannot match. Reach for a regex only when the name has real shape, and anchor it end to end.

---

## Where a Visitor Fails Silently

Three, and they are all the same shape: the rule does nothing, and nothing says so.

**A typo'd visitor key never fires.** `{ ImportDeclaraton(node) { … } }` loads clean, runs, reports nothing, exits 0. Visitor keys are not validated against the node types — an unknown key is a key nothing visits, and the result is indistinguishable from a codebase with no violations. Note the asymmetry with the config, where the *same* typo is fatal: the half that is checked is the half that does not matter.

**A parent is visited before its children.** The walk is depth-first and pre-order, so no visitor can answer "does this subtree contain X" at the moment it sees the enclosing node. Any rule shaped as a claim about a subtree records what it sees and decides at `"Program:exit"`; [lib/range-index.ts](rules/lib/range-index.ts) is that pattern factored out.

**A rule sees one file.** A rule instance is created per file and knows nothing about any other. It cannot resolve a specifier to the file it lands in, ask whether a directory exists, or aggregate across a file set. Everything of that shape is a structural script: cycles, coupling, transitive barrel purity, and the depth-dependent question of whether `../../beta` leaves the current feature.

---

## Adding a New Rule

1. Read the template `rules/<tag>/<name>.ts` and the spec beside it, `rules/<tag>/<name>.test.ts`
2. Copy both into `oxlint/<tag>/` and adapt the named constants at the top — the template's *Adapt* section names which. The constants are hoisted precisely so adaptation is an edit to a regex or a list, not a rewrite of the visitor
3. Register it in the plugin module under its file name
4. Switch it on in `.oxlintrc.json`. Registered but unlisted is loaded and never run
5. Extend the three-kind spec (below) — the adversarial cases decide whether the rule works
6. Run it through the real-Node launcher
7. Revert-probe: misspell the visitor key or invert a guard and watch the adversarial kind fail; break the exemption and watch the legal kind fail; restore both. A spec that stays green through that is asserting nothing
8. Run `bun run check:arch` against the real tree. A hit is either a false positive (narrow the rule) or a true violation — and true violations are the rollout: sweep them in the same change the rule lands in. A rule that ships alongside its own open violations either blocks everyone or teaches everyone to ignore it

## Adopting a Structural Check

Not "implementing" — the catalog's checks are runnable modules, proved against fixtures in the skill's own CI. Reimplementing one from its doc is how a check ends up silently matching less than the doc promises, which is what happened at three separate deployments before this tier shipped as code.

1. Copy `rules/scripts/{config,lib,import-graph,run-structural-checks}.ts` into `scripts/`, plus each selected `rules/<tag>/<name>.ts`
2. Register the checks in `scripts/registry.ts`. A check that is not registered is a file that ships and never runs
3. Write `arch.config.ts`: spread `defaultCheckConfigs` and override what differs. Each rule's *Adapt* section names its keys, because the config object is the entire adoption surface
4. Run once against the real tree and calibrate thresholds *just above* current values, so they signal growth rather than firing on day one. A check that fires on the state of the world the day it was installed gets switched off in the same week
5. Write the project's three cases against its own code. The catalog's fixtures prove the check; yours prove the config
6. Run `bun run check:arch`

## Adding a Genuinely New Structural Check

1. Export a `StructuralCheck` — an `id` and a `run(context)` that **returns findings**. The orchestrator owns reporting and the exit code, which is what lets warnings be staged-scoped and lets one check throw without silencing the rest
2. Take imports from `context.importGraph()` and file sets from the shared collection helpers. Do not scan files for imports directly: the union of Bun's two scans and the JSX-runtime filter are where the silent losses live
3. Put every per-repo value in the config object, never as a constant in the check body. The test is whether a second project could adopt it by writing config alone
4. Write its three cases, then revert-probe: disable the matcher and watch the adversarial case report as missed

---

## Rule Specs

**Specs are permanent and they run in CI.** A rule is code with exactly one job and a silent failure mode: when it stops matching it does not error, it goes green. Enforcement code needs regression tests more than application code does, because application code has users who notice.

Every rule ships its spec beside it, importing the rule file directly — one artifact, no second copy to drift. The three kinds and why each exists are the contract of [lib/rule-spec.ts](rules/lib/rule-spec.ts), which throws on an empty list.

Two things the contract cannot enforce for you:

- **Assert the diagnostics exactly** — the count as well as the message id, so a missing diagnostic (a dead branch) and a duplicate on an expected line (an over-match) both fail. The expectation lives on the case, so extending a case extends its expectation.
- **Give every case a full realistic `filename`** (`/repo/src/features/billing/service/charge.ts`), because the rules read the path: a path-guarded rule checked against a bare basename passes vacuously. A by-path exemption gets its own legal case — the exempted file carrying the leak spelling verbatim — and its own adversarial case for the near-miss the exemption must *not* cover (`legacy-repo/` is not `repo/`).

### Adversarial checklist

Write the case even when you are confident:

| Axis | The shape that gets past |
|---|---|
| Import clause arity | `import { a, b } from "m"` where the rule tested only the first specifier |
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

The harness is enforcement code with the same silent failure mode as the rules it guards. After writing a rule's spec — and after any harness change — break the rule and expect the adversarial kind to fail; break its exemption and expect the legal kind to fail; restore both. A harness that stays green through both mutations is not testing anything.

### Where the specs fit the pipeline

The spec suite runs inside `check:arch`, so a broken rule fails the same gate a broken boundary does. When a rule is known-broken and not yet repaired, land its spec failing rather than omitting it — that is what makes the backlog visible instead of theoretical.

Beyond the specs themselves, the runner checks the three things a spec cannot say about itself, each of which leaves a green run behind a rule nothing exercises: a rule with no spec beside it, a spec pointed at a different rule than the one it sits next to, and a rule missing from the plugin module — tested, and never loaded.
