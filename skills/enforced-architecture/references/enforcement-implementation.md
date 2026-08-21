# Enforcement Implementation

How to wire up the enforcement infrastructure. Not the rules themselves — those live in [lint/](lint/overview.md).

Most of these ship as commented files. Copy them and read the comments in place; the gotchas live on the lines they govern. `jscpd.json` is the one that cannot carry its own: jscpd parses it as strict JSON and dies on the first comment, so its rationale sits under *Package.json Scripts* below.

| Artifact | Copy from | Target |
|---|---|---|
| oxlint config | [setup/oxlintrc.json](setup/oxlintrc.json) | `.oxlintrc.json` (repo root; root of the monorepo) |
| Pre-commit hook | [setup/lefthook.yml](setup/lefthook.yml) | `lefthook.yml` |
| Duplication config | [setup/jscpd.json](setup/jscpd.json) | `.jscpd.json` (repo root) |
| oxlint tier program | [setup/oxlint.tsconfig.json](setup/oxlint.tsconfig.json) | `lint/oxlint/tsconfig.json` |
| Structural tier program | [setup/structural.tsconfig.json](setup/structural.tsconfig.json) | `lint/structural/tsconfig.json` |
| Real-Node spec launcher | [setup/with-real-node.sh](setup/with-real-node.sh) | `lint/oxlint/with-real-node.sh` |
| Shared policy tables | [lint/policy/](lint/policy/overview.md) | `lint/policy/` (copied whole; `declared-trees.ts` is the one file edited) |
| Structural check substrate | [lint/structural/](lint/structural/) | `lint/structural/` |
| Rule catalog | [lint/](lint/overview.md) | `lint/` (mirrors the catalog's tier split) |
| Framework import protection | [server-client-boundaries.md](server-client-boundaries.md) | `vite.config.ts` |

---

## The policy tables, below both tiers

`lint/policy/` is neither tier. It holds the tables both of them read — the layout vocabulary, the
import policy, and the package ownership rows — under a neutrality contract: no Node APIs, no Bun
APIs, no oxlint or ESTree types, no import from either tier. See
[lint/policy/overview.md](lint/policy/overview.md).

Copy it **first**. Both tiers import from it, both tsconfigs include it, and a rule whose *Adapt*
section says "nothing here" is a rule whose adaptation happens in
[lint/policy/declared-trees.ts](lint/policy/declared-trees.ts) — the list of trees this project
adopted the catalog for, each carrying the vocabulary its own directories are spelled in.

The point of the contract is that one edge cannot reach two verdicts depending on how it was
spelled. Split a table back into a per-tier copy and the two copies drift without either failing:
each tier can only see its own.

### Declare every tree, and know what an undeclared one costs

`DECLARED_TREES` is a list of source roots. **A tree you did not declare is a tree you did not adopt
for.** Every TREE-SCOPED rule in this catalog — both tiers — is *silent* outside every declared
tree: no findings, no warnings, no "unclassified" diagnostic. That silence is not coverage. A repo
that adds `packages/reporting/` and forgets this file has added an unpoliced tree, and a clean run
over it looks exactly like a clean run over a governed one.

Three checks are deliberately not tree-scoped, and naming them is part of stating the silence
honestly rather than a loophole in it. `testing/no-module-mocking` is enabled globally because its
subject is a test file, which `classifyFileRole` reports as no subject at all — including the
repo-root `test/` directory this catalog treats as a first-class convention. `health/file-size` and
`health/doc-budgets` are project-scoped: file size and doc weight are questions about anything a
human maintains, so they walk their own configured roots. None of the three says anything about
architecture, so an undeclared package is still architecturally ungoverned.

So the declaration list is the adoption decision, and it is the only place the answer lives:

- The oxlint tier resolves the file it is handed into a tree before it matches anything, and
  `.oxlintrc.json` scopes the `arch/` rules to the same roots — one `<root>/**` glob per declared
  root. `harness/run-rule-fixtures.ts` fails the build when the two lists disagree in either
  direction, because a root in one and not the other is a tree that reads as governed and is not.
  A nested `.oxlintrc.json` inside each workspace that `extends` the root config is the same scoping
  expressed as file placement; either way the declaration list is the source of truth.
- The structural tier runs every tree-scoped check once per declared tree, against that tree's own
  import graph and vocabulary. `health/file-size` and `health/doc-budgets` are the two exceptions
  and are project-scoped by argument: a file's length and a document's word count are not positions
  in an architecture.

What a tree declaration may vary is **names and numbers** — the source root, the alias prefix, what
the directories and feature layers are called, the thresholds. What it cannot vary is which rules
apply to it: there is no per-tree rule list, and adding one would turn the catalog back into a menu.

Two things stay outside every tree's reach, and they are worth writing in the project's own setup
notes rather than assuming: **an edge from one declared tree into another is in neither tree's graph
and nothing reports it**, and a file outside every declared tree is silent for every tree-scoped
rule — `testing/no-module-mocking`, `health/file-size` and `health/doc-budgets` are the three that
still run there.

---

## The oxlint tier

Per-file rules are oxlint JS plugins: one `.ts` file per rule, every rule registered in **one** plugin module, that module named in `.oxlintrc.json`. Organize rule files by tag on disk (`lint/oxlint/boundary/db-isolation.ts`) — the same tier-then-tag tree the catalog ships.

Three dev dependencies beyond `oxlint`. `oxlint-tsgolint` backs `options.typeAware`; `eslint-plugin-sonarjs` loads through the same `jsPlugins` array as the architecture rules, so the duplication and identity checks cost one package rather than a second tool. `jscpd` is neither — a separate binary, below. What each buys and what breaks without it is on the lines that switch them on, in [setup/oxlintrc.json](setup/oxlintrc.json).

Rules share a `lib/`, and the sharing is load-bearing rather than tidy. One module owns each concern, so a new rule inherits the fix rather than a copy of the bug:

- [lib/module-source-visitor.ts](lint/oxlint/lib/module-source-visitor.ts) — every place a module specifier can appear.
- [lib/imported-names.ts](lint/oxlint/lib/imported-names.ts) — every name a file takes from one module, under the exporting module's spelling, and the walk from a load expression to the module object.
- [lib/static-key-name.ts](lint/oxlint/lib/static-key-name.ts) — the name a property key spells, dotted or computed.
- [lib/transparent-wrappers.ts](lint/oxlint/lib/transparent-wrappers.ts) — the TypeScript nodes that wrap a value without changing what it is.
- [lib/source-ordered-reports.ts](lint/oxlint/lib/source-ordered-reports.ts) — a rule's diagnostics emitted in source order, for a rule that reports from both traversal and a whole-file pass.
- [lib/range-index.ts](lint/oxlint/lib/range-index.ts) — subtree questions answered at `Program:exit`.
- [lib/rule-options.ts](lint/oxlint/lib/rule-options.ts) — reading a configured option without trusting `meta.schema` to have held.
- [lib/rule-spec.ts](lint/oxlint/lib/rule-spec.ts) — the three-kind spec contract.

**oxlint's JS plugins are alpha** as of 1.77 and say so. The API is ESLint's `create(context)` returning a visitor, so the exposure is churn in a young API, not a design bet.

---

## Structural Check Orchestration

An orchestrator runs all structural checks. Each check is a function returning findings — errors (blocking) and warnings (non-blocking). The orchestrator reports every error, reports the warnings that survive scoping, counts both, and exits 1 if any errors.

**One process, one exit code. Never a shell chain.** `check-a && check-b && check-c` stops at the first non-zero exit, so a tree with four violations reports one, you fix it, and the next appears — four round trips where there should be one, and worst exactly when the tree is in the worst shape.

The same trap catches the tiers *above* the orchestrator, and it is easy to fix the scripts and leave it in place one level up. Watch two:

- `check:arch` written as `oxlint src && check:structural` lets a lint failure hide every structural finding.
- `typecheck` written as `tsc --noEmit && tsc --noEmit -p lint/oxlint && tsc --noEmit -p lint/structural` lets an app type error hide every error in the check scripts themselves.

Run each independently and aggregate. Reserve `&&` for steps where the second genuinely cannot run after the first fails.

### The substrate

Structural checks ship with the modules they share, and the sharing is the point: duplicated across scripts, they drift apart on exclusions and on what counts as an import, without either copy reporting that it has.

- **`config.ts`** — every per-repo value for every check, one object: the project root, the JSX package, and per-check thresholds, manifests, trace limits and allowlists. The shape of the tree is *not* among them and cannot be put there — where the trees are and what their directories are called is [lint/policy/declared-trees.ts](lint/policy/declared-trees.ts), which both tiers read. There is nothing to keep in step, which is why the paragraph that used to ask you to is gone.
- **`check-substrate.ts`** — the two shapes a check can be handed. A `TreeContext` is one declared tree: its vocabulary, its source root, its import graph, and file collection with the shared exemptions applied. A `ProjectContext` is the config and nothing about any tree. `StructuralCheck` is a union over the two, so a check cannot receive a context its scope never produces.
- **`import-graph.ts`** — the resolved graph for one tree, and `scanDeclaredImports` for the one check that needs raw specifiers instead. Any check asking where an import *lands* consumes this rather than matching how the specifier is spelled.
- **`run-structural-checks.ts`** — the orchestrator.

Centralising the *same* patterns into a shared file reduces duplication and fixes no correctness. Reach for the reader at the same time, or the shared library is only tidier, not better.

**`Bun.Transpiler` answers questions about imports and exports, and nothing else.** It exposes import paths and kinds, export names, and transformed JavaScript — not component boundaries, call expressions, parameter structure, or TypeScript property signatures, and `transform()` erases the very annotations a props reader needs. So it retires the extraction patterns and no others. The three counting checks that used to live here on patterns — `react/prop-count`, `react/hook-count`, `react/single-component-export` — are oxlint rules now, which is where a question about syntax belongs: the plugin tier hands them a real AST, and every silent failure those three ever had came from parsing rather than from counting.

### Staged-scoped warnings

At pre-commit, advisory warnings scope to the files the commit touches; blocking errors always surface repo-wide (rationale under *The Three Tiers* below). Two design constraints make it possible, and both bind any new check:

- **Every finding carries its file as structured data**, not a path buried in a message string. This is why checks *return* findings rather than printing as they go — a line already written to stdout cannot be filtered.
- **The staged set is injected, not discovered.** The orchestrator reads `STAGED_FILES` and stays agnostic to which pre-commit tool produced it. A finding with no file is kept rather than hidden — it cannot be matched, and dropping it would make scoping silently lossy.

---

## Package.json Scripts

- `check:arch` — runs `oxlint` and the structural checks **independently** and aggregates, so a lint failure cannot hide every structural finding. The single command that verifies all architectural constraints.
- `check:structural` — structural checks only. For iterating on structural-check changes without re-running lint.
- `duplication` — `jscpd --config .jscpd.json src scripts`. A separate binary with its own exit code, not an oxlint plugin, and it runs in CI only. 60 tokens / 6 lines, matched on normalized tokens in `mild` mode: renaming every variable does not hide the clone, and neither does inserting a comment or a blank line. `sonarjs/no-identical-functions` in `.oxlintrc.json` catches what fits inside one rule's window; this catches the copy that spans files. Fence repetition that is genuinely irreducible with `/* jscpd:ignore-start */ … /* jscpd:ignore-end */`. Do not raise `minTokens` instead: that hides every clone of that size, not the one you meant to allow.
- `check:rules` — the rule specs, through the real-Node launcher ([setup/with-real-node.sh](setup/with-real-node.sh), which explains itself). **`RuleTester` does not run under Bun**, and under Bun the specs fail with an error naming the test framework rather than the runtime — so a working gate reads as a broken suite and invites `--no-verify`. A project on Bun also needs `bun test --path-ignore-patterns='**/oxlint/**'`, or `bun test` picks the specs up and throws on every case. The `oxlint` CLI itself is fine under Bun; this binds only the rule-authoring path.

---

## Matching Imports in a Visitor

Most rules in the catalog are import rules. Go through [lib/module-source-visitor.ts](lint/oxlint/lib/module-source-visitor.ts) — it covers every place a specifier appears and the rule supplies one callback:

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

Go through [lib/imported-names.ts](lint/oxlint/lib/imported-names.ts). It calls back once per name the file takes from the modules you name, with the node to blame:

```ts
return {
  ...visitImportedNames(context.sourceCode, [VENDOR_MODULE], (component, node) => {
    if (WRAPPED_COMPONENTS[component] !== undefined) {
      context.report({ node, messageId: "unwrappedVendorComponent" });
    }
  }),
};
```

**Do not loop an `ImportDeclaration`'s specifiers instead.** That is the natural thing to write and it is a fence with a hole in it: `import * as RN from "react-native"` names no specifier, so the primitive arrives as `RN.View` with nothing for a specifier loop to see, and `require()` and `await import()` bind the name without an `ImportDeclaration` at all. The module reads oxlint's scope analysis, which hands over the binding and every reference to it already resolved — that is the only way the namespace form is answerable per file, and for the four static spellings it is shadow-correct for free.

**The module list is a list for a reason: call it once, and spread it before your own keys.** The returned visitor is spread into the rule's own, so a second call's `ImportExpression` / `CallExpression` / `Program:exit` keys overwrite the first's and one whole module goes unchecked with nothing to see — the failure mode the next section is about. A key of the rule's own written *after* the spread silently wins the same way. Two modules go in one call; the spread goes first.

What the module settles, and what each costs to get wrong:

- **The name is the EXPORTING module's, never the local one.** `{ Textarea as TA }` reports `Textarea`. A rule matching the binding lets one rename through. (On the export side you still read specifiers yourself: `imported` is the exported name, `local` the binding, and a re-export's `local` is the name the source module used.)
- **Every name is tested.** `import { Button, Textarea }` reports `Textarea`. A rule reading `node.specifiers[0]` passes that import silently — the second name in a clause is the cheapest thing in this catalog to miss.
- **Type-only is two flags, not one.** `import type { X }` sets `importKind: "type"` on the *declaration*; `import { type X }` sets it on the *specifier* — and the specifiers of a type-only declaration each report `"value"`, so a rule checking one level and not the other lets the other spelling through. `visitImportedNames` drops both, because a type import binds no runtime value. A rule about coupling rather than about the bundle wants the opposite and reads specifiers itself — `boundary/db-isolation` reports `import type { Invoice }` from the schema, because knowing the schema's shape is the dependency it exists to prevent.

- **`require` is resolved, not matched by name.** A file that shadows it (`function f(require) { … }`) is calling its own function, and loads nothing. The resolution asks the reference rather than the scope chain, because a name lookup answers a different question: `type require = number` declares nothing callable, and the loader's own ambient declaration (`declare function require(id: string): any`) would read as a rebind and turn the fence off for the whole file.

Compare against a `Set` of exact names, so `TextareaProps` cannot match. Reach for a regex only when the name has real shape, and anchor it end to end.

---

## Where a Visitor Fails Silently

Three, and they are all the same shape: the rule does nothing, and nothing says so.

**A typo'd visitor key never fires.** `{ ImportDeclaraton(node) { … } }` loads clean, runs, reports nothing, exits 0. Visitor keys are not validated against the node types — an unknown key is a key nothing visits, and the result is indistinguishable from a codebase with no violations. Note the asymmetry with the config, where the *same* typo is fatal: the half that is checked is the half that does not matter.

**A parent is visited before its children.** The walk is depth-first and pre-order, so no visitor can answer "does this subtree contain X" at the moment it sees the enclosing node. Any rule shaped as a claim about a subtree records what it sees and decides at `"Program:exit"`; [lib/range-index.ts](lint/oxlint/lib/range-index.ts) is that pattern factored out.

**A rule sees one file.** A rule instance is created per file and knows nothing about any other. It cannot resolve a specifier to the file it lands in, ask whether a directory exists, or aggregate across a file set. Everything of that shape belongs to the structural tier: cycles, coupling, transitive barrel purity, and — the least obvious and most damaging — **anything whose answer depends on where the importing file sits.** Whether `../../beta` leaves the current feature is a function of the importing file's depth, not of the import string, so it has to be *resolved and compared*, never matched. A rule written the matching way looks right, passes its spec, and silently permits the shortest spelling of the violation. See [lint/structural/import-graph.ts](lint/structural/import-graph.ts).

---

## Adding a New Rule

1. Read the template `lint/oxlint/<tag>/<name>.ts` and the spec beside it, `lint/oxlint/<tag>/<name>.test.ts`
2. Copy both into the project's `lint/oxlint/<tag>/` and adapt the named constants at the top — the template's *Adapt* section names which. Those constants are names, numbers and explicit rows; a constant that was a path pattern would be an off-switch, so none is. A template whose *Adapt* section says **nothing here** — which is nearly all of them — reads `lint/policy/`: it needs no edit, and editing it instead of the tree's vocabulary gives that rule a private answer the other tier will not share
3. Register it in the plugin module under its file name
4. Switch it on in `.oxlintrc.json`. Registered but unlisted is loaded and never run
5. Extend the three-kind spec (below) — the adversarial cases decide whether the rule works
6. Run it through the real-Node launcher
7. Revert-probe: misspell the visitor key or invert a guard and watch the adversarial kind fail; break the exemption and watch the legal kind fail; restore both. A spec that stays green through that is asserting nothing
8. Run `bun run check:arch` against the real tree. A hit is either a false positive (narrow the rule) or a true violation — and true violations are the rollout: sweep them in the same change the rule lands in. A rule that ships alongside its own open violations either blocks everyone or teaches everyone to ignore it

## Adopting a Structural Check

Not "implementing" — the catalog's checks are runnable modules, proved against fixtures in the skill's own CI. Reimplementing one from its doc is how a check ends up silently matching less than the doc promises, which is what happened at three separate deployments before this tier shipped as code.

1. Copy `lint/policy/` first if it is not already there, then `lint/structural/{config,check-substrate,import-graph,registry,run-structural-checks}.ts` into the project's `lint/structural/`, plus every `lint/structural/<tag>/<name>.ts`
2. Register the checks in `lint/structural/registry.ts`. A check that is not registered is a file that ships and never runs
3. Declare the project's trees in `lint/policy/declared-trees.ts`, then write `arch.config.ts`: spread `defaultCheckConfigs` and override what differs. Each rule's *Adapt* section names its keys, because the config object is where every per-repo *value* lives. Directory names, the alias prefix and the layer order are not among them — the config has no field for them, so the two tiers cannot end up policing two different trees
4. Run once against the real tree and calibrate thresholds *just above* current values, so they signal growth rather than firing on day one. A check that fires on the state of the world the day it was installed gets switched off in the same week
5. Write the project's three cases against its own code. The catalog's fixtures prove the check; yours prove the config
6. Run `bun run check:arch`

## Adding a Genuinely New Structural Check

1. Export a `StructuralCheck` — an `id`, a `scope`, and a `run(context)` that **returns findings**. The orchestrator owns reporting and the exit code, which is what lets warnings be staged-scoped and lets one check throw without silencing the rest
2. Pick the scope by what the check asks about. `"tree"` runs it once per declared tree and hands it that tree's vocabulary and graph; `"project"` is for a question with no position in it, and there are two of those. A tree-scoped check reading a project path, or the reverse, is a check whose subject and scope disagree
3. Take imports from `context.importGraph()` and file sets from `collectTreeFiles` / `collectProjectFiles`, with the source glob from `lint/policy/layout.ts`. Do not scan files for imports directly, and do not spell your own extension list: the union of Bun's two scans and the JSX-runtime filter are where the silent losses live, and six checks each spelling their own glob is how four of them ended up wrong about `.mts`
4. Put every per-repo value in the config object, never as a constant in the check body. Names of directories and layers are not per-repo values — read them off `context.vocabulary`. The test is whether a second project could adopt it by writing config and a tree declaration alone
5. Write its three cases, then revert-probe: disable the matcher and watch the adversarial case report as missed

---

## The Three Tiers

Same rules, three moments, decreasing value.

**Tier 1 — the editor.** oxlint's language server publishes JS-plugin diagnostics like any built-in rule, so an agent sees a bad import underlined as it writes it. The per-file tier only; structural checks are too slow to run here. Surface only what makes the agent change its approach — formatting and import order are Tier 2's silent business.

**Tier 2 — pre-commit.** The formatter runs first and alone, then the read-only gates run in parallel: `oxlint`, the structural checks, typecheck, tests. Under 15 seconds is the budget. **Scope follows the check:** format and lint see the staged files, because a repo-wide formatter would rewrite what another agent is mid-edit on and someone else's per-file violation isn't this commit's problem; typecheck, tests and structural checks see the whole repo, because those catch what is broken no matter who wrote it. [setup/lefthook.yml](setup/lefthook.yml) is the mechanism and carries its own gotchas.

**Tier 3 — CI.** The same checks, as the safety net for `--no-verify`. Only `duplication` is CI-only, because scanning the tree for clones does not fit the hook budget. A violation reaching Tier 3 means the loop already failed; the goal is to catch everything above it.

---

## Rule Design Principles

**Every rule is blocking by default.** Three exceptions qualify and nothing else does — [architecture-principles.md](architecture-principles.md#all-rules-blocking-from-day-one) has the list and the argument.

**Rules detect the narrowest possible violation.** A rule that catches too much trains agents to work around it. If a rule needs many exceptions, it is too broad.

**Error messages are the documentation.** A message must let the agent fix the violation without opening anything else. Per-file messages live in `meta.messages` keyed by `messageId`; oxlint renders one as `error <plugin>(<rule>): <message>`, and since the rule key is its file name, the diagnostic id is also the path to the rule that raised it. Structural findings use:

```
FAIL [rule-name] path/to/file.ts
  What's wrong in one sentence.
  What to do about it, with specific paths.
```

`WARN` is the same shape, non-blocking.

**One global exemption, in one place and never per rule.** Every rule but `boundary/no-test-imports` skips test files (`*.test.*`, `__tests__/`, `test/`), one-off scripts (`scripts/`), generated and ambient modules (`*.gen.*`, `*.d.*`), and every directory a tree declares as generated output. It lives in `isArchitectureExemptSourcePath` in `lint/policy/declared-trees.ts`, which both tiers read — the oxlint tier through `defineTreeRule`, the structural tier through its file collection. Per-rule copies drift, and they drift identically: each one over-matches the same way and each has to be found separately.

---

## Rule Specs

**Specs are permanent and they run in CI.** A rule is code with exactly one job and a silent failure mode: when it stops matching it does not error, it goes green. Enforcement code needs regression tests more than application code does, because application code has users who notice.

Every rule ships its spec beside it, importing the rule file directly — one artifact, no second copy to drift. The three kinds and why each exists are the contract of [lib/rule-spec.ts](lint/oxlint/lib/rule-spec.ts), which throws on an empty list.

Two things the contract cannot enforce for you:

- **Assert the diagnostics exactly** — the count as well as the message id, so a missing diagnostic (a dead branch) and a duplicate on an expected line (an over-match) both fail. The expectation lives on the case, so extending a case extends its expectation.
- **Give every case a full realistic `filename`** (`/repo/src/features/billing/service/charge.ts`), because the rules classify the path through `lint/policy/`: a rule checked against a bare basename lands in no declared tree, so it is silent and the case passes vacuously. A structural exemption gets its own legal case — the exempted file carrying the leak spelling verbatim — and its own adversarial case for the near-miss the classifier must *not* fold in (`legacy-repo/` is not the `repo` layer).

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
| Segment boundary | `legacy-repo/` reading as the `repo` layer, `@/features-legacy` as `@/features` — the classifiers in `lint/policy/layout.ts` own this, so the case belongs there as well as here |
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
