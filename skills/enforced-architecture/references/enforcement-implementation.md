# Enforcement Implementation

How to wire up the enforcement infrastructure. The rules themselves live in
[lint/](lint/overview.md).

Most of these artifacts ship as commented files. Copy them and read the comments in place — each
gotcha sits on the line it governs. Two are parsed as strict JSON and die on the first comment:
`jscpd.json` and `doc-budgets.manifest.json`.

| Artifact | Copy from | Target |
|---|---|---|
| Shared policy tables | [lint/policy/](lint/policy/overview.md) | `lint/policy/` — copied whole; `declared-trees.ts` is the one file you edit |
| Rule catalog | [lint/](lint/overview.md) | `lint/` — mirrors the catalog's tier split |
| oxlint config | [setup/oxlintrc.json](setup/oxlintrc.json) | `.oxlintrc.json` at the repo root |
| Pre-commit hook | [setup/lefthook.yml](setup/lefthook.yml) | `lefthook.yml` |
| Duplication config | [setup/jscpd.json](setup/jscpd.json) | `.jscpd.json` |
| Doc word ceilings | [setup/doc-budgets.manifest.json](setup/doc-budgets.manifest.json) | `docs/doc-budgets.manifest.json` |
| oxlint tier program | [setup/oxlint.tsconfig.json](setup/oxlint.tsconfig.json) | `lint/oxlint/tsconfig.json` |
| Structural tier program | [setup/structural.tsconfig.json](setup/structural.tsconfig.json) | `lint/structural/tsconfig.json` |
| Real-Node spec launcher | [setup/with-real-node.sh](setup/with-real-node.sh) | `lint/oxlint/with-real-node.sh` |
| Framework import protection | [server-client-boundaries.md](server-client-boundaries.md) | `vite.config.ts` |

---

## Copy `lint/policy/` First

`lint/policy/` is neither tier. It holds the tables both tiers read: the layout vocabulary, the
import policy, and the package ownership rows. It works under a neutrality contract — no Node APIs,
no Bun APIs, no oxlint or ESTree types, and no import from either tier. See
[lint/policy/overview.md](lint/policy/overview.md).

Copy it before either tier. Both tiers import it and both tsconfigs include it. No oxlint rule is
adapted in its own file — every one reads its layout from
[lint/policy/declared-trees.ts](lint/policy/declared-trees.ts), so that file is the adaptation.

The contract exists so one edge cannot reach two verdicts depending on how it was spelled. Split a
table per tier and the copies drift with neither failing: each tier sees only its own.

### Declare every tree

`DECLARED_TREES` is the list of source roots this project adopted the catalog for. A monorepo
declares one entry per governed source root, each carrying the vocabulary its own directories use:

```ts
export const DECLARED_TREES: ValidatedTrees = declareTrees([
  { root: "apps/web/src", vocabulary: RECOMMENDED_VOCABULARY, tsconfig: "apps/web/tsconfig.json" },
  {
    root: "packages/core/src",
    vocabulary: { ...RECOMMENDED_VOCABULARY, infrastructureDir: "db" },
    tsconfig: "packages/core/tsconfig.json",
  },
]);
```

A single-package repo declares one entry. That is the only difference.

`tsconfig` is a project-relative PATH, not compiler options: the seven `types/` checks read a real
TypeScript program, and the project already says what its code compiles as. A tree whose tsconfig
misses a `.ts` file the tree holds fails the run with that path named — a program holding none of
them reports nothing, which is what a clean tree reports too.

**A tree you did not declare is a tree you did not adopt for.** Every tree-scoped rule in the
catalog, in both tiers, is silent outside every declared tree. No findings, no warnings, no
"unclassified" diagnostic. That silence is not coverage: a repo that adds `packages/reporting/` and
forgets this file has added an unpoliced tree, and its clean run looks exactly like a governed one's.
Write that sentence into the project's own setup notes. An adopter who reads only those notes is the
one who will add the package.

Three checks are deliberately not tree-scoped, and naming them is part of stating the silence
honestly:

- `testing/no-module-mocking` runs everywhere, because its subject is a test file.
- `health/file-size` and `health/doc-budgets` are project-scoped and walk their own roots: a file's
  length and a document's word count are not positions in an architecture.

None says anything about architecture, so an undeclared package is still architecturally ungoverned.

Two more things sit outside every tree's reach, and both belong in the project's setup notes:

- An edge from one declared tree into another is in neither tree's graph, and nothing reports it.
- A file outside every declared tree is silent for every tree-scoped rule.

A tree declaration may vary **names and numbers**: the source root, the alias prefix, what the
directories and feature layers are called, the thresholds. It may not vary which rules apply. There
is no per-tree rule list, and adding one would turn the catalog back into a menu.

The declaration list is also the scoping list. `.oxlintrc.json` scopes the `arch/` rules to the same
roots with one `<root>/**` glob per root, and `harness/run-rule-fixtures.ts` fails the build when the
two disagree either way. A nested `.oxlintrc.json` per workspace that `extends` the root config
expresses the same scoping as file placement; `declared-trees.ts` stays the source of truth.

---

## The oxlint Tier

Per-file rules are oxlint JS plugins: one `.ts` file per rule, every rule registered in one plugin
module, that module named in `.oxlintrc.json`. Organize the rule files by tag on disk
(`lint/oxlint/boundary/db-isolation.ts`), the same tier-then-tag tree the catalog ships.

Four dev dependencies beyond `oxlint` itself:

- **`@oxlint/plugins`** — every rule and every `lib/` module imports it. Without it nothing loads.
- **`oxlint-tsgolint`** — backs `options.typeAware`.
- **`eslint-plugin-sonarjs`** — loads through the same `jsPlugins` array as the architecture rules,
  so the duplication and identity checks cost one package rather than a second tool.
- **`jscpd`** — a separate binary, not a plugin. See *Scripts* below.

What each buys, and what breaks without it, is on the lines that switch them on in
[setup/oxlintrc.json](setup/oxlintrc.json).

Rules share `lint/oxlint/lib/`, and the sharing is load-bearing rather than tidy: one module owns
each concern, so a new rule inherits the fix rather than a copy of the bug. Every module documents
itself in its own header. Read the directory before you write a rule.

**oxlint's JS plugins are alpha** as of 1.77 and say so. The API is ESLint's `create(context)`
returning a visitor, so the exposure is churn in a young API, not a design bet.

### Writing a rule that matches imports

Most rules in the catalog are import rules. Two modules own that job, and a hand-rolled visitor is
the mistake both exist to prevent.

- [lib/module-source-visitor.ts](lint/oxlint/lib/module-source-visitor.ts) — every place a module
  specifier can appear. A hand-written `ImportDeclaration` visitor covers one form of several.
- [lib/imported-names.ts](lint/oxlint/lib/imported-names.ts) — every name a file takes from a **set**
  of modules, under the exporting module's spelling. It takes a list of modules, not one, and calling
  it twice is the failure it is shaped to prevent.

Both headers state their own contracts, including which visitor keys they return and which the
consuming rule still owns. Read them there — a second copy of a contract is the thing this catalog
most reliably gets wrong.

### Where a visitor fails silently

**A typo'd visitor key never fires.** `{ ImportDeclaraton(node) { … } }` loads clean, runs, reports
nothing, exits 0. Visitor keys are not validated against the node types, so an unknown key is a key
nothing visits, and the result is indistinguishable from a codebase with no violations. Note the
asymmetry with the config, where the same typo is fatal: the half that is checked is the half that
does not matter.

**A parent is visited before its children.** The walk is depth-first and pre-order, so no visitor can
answer "does this subtree contain X" at the moment it sees the enclosing node. A rule shaped as a
claim about a subtree records what it sees and decides at `Program:exit`.
[lib/range-index.ts](lint/oxlint/lib/range-index.ts) is that pattern factored out.

**A rule sees one file.** A rule instance is created per file and knows nothing about any other. It
cannot resolve a specifier to the file it lands in, ask whether a directory exists, or aggregate
across a file set. Everything of that shape belongs to the structural tier — including the least
obvious case: anything whose answer depends on where the importing file sits. Whether `../../beta`
leaves the current feature is a function of the importing file's depth, not of the import string, so
it has to be resolved and compared rather than matched. A rule written the matching way looks right,
passes its spec, and silently permits the shortest spelling of the violation. See
[lint/structural/import-graph.ts](lint/structural/import-graph.ts).

---

## The Structural Tier

An orchestrator runs every structural check. Each check is a function that **returns** findings —
errors block, warnings do not. The orchestrator reports every error, reports the warnings that
survive scoping, counts both, and exits 1 if any error exists.

**One process, one exit code. Never a shell chain.** `check-a && check-b && check-c` stops at the
first non-zero exit, so a tree with four violations reports one, you fix it, and the next appears.
That is four round trips where there should be one, and it is worst exactly when the tree is in the
worst shape.

The same trap catches the scripts *above* the orchestrator, and it is easy to fix one level and leave
it at the next: `check:arch` as `oxlint src && check:structural` lets a lint failure hide every
structural finding, and `typecheck` as one `&&` chain of `tsc` runs lets an app type error hide every
error in the check scripts. Run each independently and aggregate. Reserve `&&` for a step that
genuinely cannot run after the one before it failed.

### The substrate

Structural checks ship with the modules they share. Duplicated across scripts, those modules drift
apart on exclusions and on what counts as an import, and neither copy reports that it has.

- **`config.ts`** — every per-repo value for every check, in one object: the project root, the JSX
  package, and per-check thresholds, manifests, trace limits and package lists. The shape of the tree
  is not among them and cannot be put there. Where the trees are and what their directories are
  called is [declared-trees.ts](lint/policy/declared-trees.ts), which both tiers read.
- **`check-substrate.ts`** — the two shapes a check can be handed. A `TreeContext` is one declared
  tree: its vocabulary, its source root, its import graph, and the directory questions a check asks
  about that tree. A `ProjectContext` is the config and nothing about any tree. `StructuralCheck` is
  a union over the two, so a check cannot receive a context its scope never produces. File collection
  is a free function taking a context, not a member of one.
- **`import-graph.ts`** — the resolved graph for one tree, plus `scanDeclaredImports` for the one
  check needing raw specifiers. A check asking where an import *lands* consumes the graph, never the
  specifier's spelling.
- **`type-checker.ts`** — one TypeScript process per run, one program per declared tree, built
  lazily so a project running no `types/` check never spawns it. The tier's dev dependencies are
  `oxc-resolver` and `typescript` 7, whose `unstable/async` API this is the one file to import.
- **`module-resolution.ts`** — where one specifier lands, over `oxc-resolver`. It sees what path
  arithmetic cannot: `./rows.js` naming `rows.ts`, a directory naming its barrel. No knob — it reads
  the tree's vocabulary.
- **`registry.ts`** — the check list, copied whole. **`run-structural-checks.ts`** — the orchestrator.

Centralising a *pattern* reduces duplication and fixes no correctness. Reach for the reader at the
same time, or the shared module is only tidier.

**`Bun.Transpiler` answers questions about imports and exports, and nothing else.** It exposes import
paths and kinds, export names, and transformed JavaScript — not component boundaries, call
expressions, parameter structure or TypeScript property signatures, and `transform()` erases the very
annotations a props reader needs. Any question about syntax belongs to the plugin tier, which is
handed a real AST.

### Staged-scoped warnings

At pre-commit, advisory warnings scope to the files the commit touches. Blocking errors always
surface repo-wide. Two design constraints make that possible, and both bind any new check:

- **Every finding carries its file as structured data**, never a path buried in a message string.
  This is why checks return findings rather than printing as they go: a line already written to
  stdout cannot be filtered.
- **The staged set is injected, not discovered.** The orchestrator reads `STAGED_FILES` and stays
  agnostic about which pre-commit tool produced it. With the variable unset, nothing is filtered.

---

## Scripts

- **`check:arch`** — runs `oxlint` and the structural checks independently and aggregates their exit
  codes. The single command that verifies every architectural constraint.
- **`check:structural`** — the structural checks alone, for iterating on one without re-running lint.
- **`check:rules`** — the rule specs, through the real-Node launcher
  ([setup/with-real-node.sh](setup/with-real-node.sh), which explains itself). **`RuleTester` does not
  run under Bun.** Under Bun the specs fail with an error naming the test framework rather than the
  runtime, so a working gate reads as a broken suite and invites `--no-verify`. A project on Bun also
  needs `bun test --path-ignore-patterns='**/oxlint/**'`, or `bun test` picks the specs up and throws
  on every case. The `oxlint` CLI itself is fine under Bun; this binds only the rule-authoring path.
- **`duplication`** — `jscpd --config .jscpd.json src scripts`. A separate binary with its own exit
  code, run in CI only because scanning the tree for clones does not fit the hook budget. It matches
  60 tokens over 6 lines on normalized tokens in `mild` mode, so renaming every variable does not
  hide the clone, and neither does inserting a comment or a blank line.
  `sonarjs/no-identical-functions` catches what fits inside one rule's window; this catches the copy
  that spans files. Fence irreducible repetition with `/* jscpd:ignore-start */ … /* jscpd:ignore-end
  */`. Do not raise `minTokens`: that hides every clone of that size, not the one you meant to
  allow.

---

## Adding a New Rule

1. Read the template `lint/oxlint/<tag>/<name>.ts` and the spec beside it,
   `lint/oxlint/<tag>/<name>.test.ts`.
2. Copy both into the project's `lint/oxlint/<tag>/`, unedited. A rule reads `lint/policy/` for
   where things live and what they are called, so there is nothing in the file to set — editing one
   instead of the tree's vocabulary gives that rule a private answer the other tier will not share.
   Two rules name a list in their own source, and neither is a knob: `boundary/client-server-infra`
   holds the client-safe module allowlist, deliberately out of config's reach, and
   `placement/deprecated-paths` holds the paths this project moved away from, which is its subject.
3. Register it in the plugin module under its file name.
4. Switch it on in `.oxlintrc.json`. Registered but unlisted is loaded and never run.
5. Extend the three-kind spec. The adversarial case is what decides whether the rule works.
6. Run it through the real-Node launcher.
7. **Revert-probe it.** Misspell the visitor key or invert a guard, and watch the adversarial kind
   fail. Break the exemption, and watch the legal kind fail. Restore both. A spec that stays green
   through that is asserting nothing.
8. Run `check:arch` against the real tree. A hit is either a false positive, which means narrow the
   rule, or a true violation. Sweep the true violations in the same change the rule lands in. A rule
   that ships alongside its own open violations either blocks everyone or teaches everyone to ignore
   it.

## Adopting a Structural Check

Not "implementing" one. The catalog's checks are runnable modules, proved against fixtures in this
repo's CI. Reimplementing one from its doc is how a check ends up silently matching less than the doc
promises, which is what happened at three separate deployments before this tier shipped as code.

1. Copy `lint/policy/` first if it is not there, then
   `lint/structural/{config,check-substrate,import-graph,registry,run-structural-checks}.ts` and
   every `lint/structural/<tag>/<name>.ts`.
2. Register the checks in `lint/structural/registry.ts`. An unregistered check is a file that ships
   and never runs.
3. Declare the project's trees, then write `arch.config.ts`: spread `defaultCheckConfigs` and
   override what differs. The keys are declared per check in
   [lint/structural/config.ts](lint/structural/config.ts); most checks take none and read the tree
   alone. Directory names, the alias prefix and the layer order are not keys anywhere: the config has
   no field for them, so the two tiers cannot end up policing two different trees.
4. Run once against the real tree and calibrate thresholds *just above* current values, so they
   signal growth rather than firing on day one. A check that fires on the world as it was installed
   gets switched off the same week.
5. Write the project's own three cases against its own code. The catalog's fixtures prove the check;
   yours prove the config.
6. Run `check:arch`.

## Adding a Genuinely New Structural Check

1. Export a `StructuralCheck`: an `id`, a `scope`, and a `run(context)` that **returns** findings.
   The orchestrator owns reporting and the exit code, which is what lets warnings be staged-scoped
   and lets one check throw without silencing the rest.
2. Pick the scope by what the check asks about. `"tree"` runs it once per declared tree and hands it
   that tree's vocabulary and graph. `"project"` is for a question with no position in it, and there
   are two of those. A tree-scoped check reading a project path, or the reverse, is a check whose
   subject and scope disagree.
3. Take imports from `context.importGraph()`, never from your own scan of file text; types from
   `context.typeChecker()`; file sets from the substrate's collectors, with the source glob from
   `lint/policy/layout.ts`. Do not spell your own extension list: six checks each spelling their own
   glob is how four ended up wrong about `.mts`.
4. Put every per-repo value in the config object, never as a constant in the check body. Names of
   directories and layers are not per-repo values — read them off `context.vocabulary`. The test is
   whether a second project could adopt the check by writing config and a tree declaration alone.
5. Write its three cases, then revert-probe: disable the matcher and watch the adversarial case
   report as missed.

---

## The Three Tiers

Same rules, three moments, decreasing value.

**Tier 1 — the editor.** oxlint's language server publishes JS-plugin diagnostics like any built-in
rule, so an agent sees a bad import underlined as it writes it. The per-file tier only; structural
checks are too slow to run here. Surface only what makes the agent change its approach. Formatting
and import order are Tier 2's silent business.

**Tier 2 — pre-commit.** The formatter runs first and alone. Then the read-only gates run in
parallel: lint, structural checks, typecheck, tests. Under 15 seconds is the budget. **Scope follows
the check.** Format and lint see the staged files, because a repo-wide formatter would rewrite what
another agent is mid-edit on, and someone else's per-file violation is not this commit's problem.
Typecheck, tests and structural checks see the whole repo, because those catch what is broken no
matter who wrote it. [setup/lefthook.yml](setup/lefthook.yml) carries its own gotchas.

**Tier 3 — CI.** The same checks, as the safety net for `--no-verify`; only `duplication` is CI-only.
A violation reaching Tier 3 means the loop above it already failed.

---

## Rule Design Principles

**A rule blocks unless its subject is a judgment.** Which rules do not block, and the two-word
header convention that says so, is
[architecture-principles.md](architecture-principles.md#what-blocks-and-what-does-not).

**Rules detect the narrowest possible violation.** One that catches too much trains agents to work
around it; one needing many exceptions is too broad.

**Error messages are the documentation.** A message must let the agent fix the violation without
opening anything else. Per-file messages live in `meta.messages` keyed by `messageId`, rendered as
`error <plugin>(<rule>): <message>` — and because a rule's key is its file name, the diagnostic id is
the path to the rule that raised it. Structural findings use:

```
FAIL [rule-name] path/to/file.ts
  What is wrong, in one sentence.
  What to do about it, with specific paths.
```

`WARN` is the same shape and does not block.

**One global exemption, in one place, never per rule.** Every rule but `testing/no-module-mocking`
skips test files (`*.test.*`, `__tests__/`, `test/`), one-off scripts (`scripts/`), generated and
ambient modules (`*.gen.*`, `*.d.*`), and every directory a tree declares as generated output. It
lives in `isArchitectureExemptSourcePath` in `lint/policy/declared-trees.ts`; the oxlint tier reads it
through `defineTreeRule`, the structural tier through its file collection.
`testing/no-module-mocking` is the exception because its subject *is* a test file. Per-rule copies
drift identically — each over-matches the same way, and each has to be found separately.

---

## Rule Specs

**Specs are permanent and they run in CI.** A rule has exactly one job and a silent failure mode:
when it stops matching it does not error, it goes green. Enforcement code needs regression tests more
than application code, which has users who notice.

Every rule ships its spec beside it, importing the rule file directly — one artifact, with no second
copy to drift. The three kinds and why each exists are the contract of
[lib/rule-spec.ts](lint/oxlint/lib/rule-spec.ts), which throws on an empty kind.

Two things the contract cannot enforce for you:

- **Assert the diagnostics exactly** — the count as well as the message id, so that a missing
  diagnostic (a dead branch) and a duplicate on an expected line (an over-match) both fail. The
  expectation lives on the case, so extending a case extends its expectation.
- **Give every case a full realistic `filename`** (`/repo/src/features/billing/service/charge.ts`),
  because the rules classify the path through `lint/policy/`. A rule checked against a bare basename
  lands in no declared tree, so it is silent and the case passes vacuously. A structural exemption
  gets its own legal case — the exempted file carrying the leak spelling verbatim — and its own
  adversarial case for the near-miss the classifier must *not* fold in (`legacy-repo/` is not the
  `repo` layer).

### Adversarial checklist

Write the case even when you are confident.

| Axis | The shape that gets past |
|---|---|
| Import clause arity | `import { a, b } from "m"` where the rule tested only the first specifier |
| Declaration form | `export default function`, an arrow assigned to a `const`, a declaration exported on a later line |
| Re-export | `export { x } from "pkg"` and `export * from "pkg"`, which carry a runtime dependency exactly like an import |
| Type-only spelling | `import { type X }` for a rule that only checks `importKind` on the declaration |
| Path depth | `../../service/x` from a nested directory, where the pattern assumed one `../` |
| Alias spelling | `@/features/self/controllers/x` for a rule matching only relative paths, and the reverse |
| Segment boundary | `legacy-repo/` reading as the `repo` layer, `@/features-legacy` as `@/features` |
| Package subpath | `pkg/lib/thing` where the rule matched bare `pkg` |
| Dynamic import | `await import("…")`, which an `ImportDeclaration` visitor does not see |
| Indirect member access | `process["env"].X`, `globalThis.process.env.X`, `React.useEffect` |
| Non-static edge | `require("…")` and side-effect `import "…"` where the extractor only handled `from` |
| Literal form | a template literal where the check matched quoted strings, and ``import(`${base}/db`)``, which nothing can fence |
| Multi-line | a re-export or type body spanning lines where a script reads one line at a time |
| Spread and shorthand | `style={[base, {…}]}`, `{ fontSize }`, a computed key |

### Mutate once to prove the harness

The harness is enforcement code with the same silent failure mode as the rules it guards. After
writing a rule's spec, and after any harness change, break the rule and expect the adversarial kind
to fail. Break its exemption and expect the legal kind to fail. Restore both. A harness that stays
green through both mutations is not testing anything.

### What the runner checks that a spec cannot

The spec suite runs inside `check:arch`, so a broken rule fails the same gate a broken boundary does.
When a rule is known-broken and not yet repaired, land its spec failing rather than omitting it: that
is what makes the backlog visible instead of theoretical.

Around the specs, the runner checks the things a spec cannot say about itself. Each one would
otherwise leave a green run behind a rule nothing exercises:

- The plugin module loads at all. A plugin that throws takes every rule silent with it.
- Every rule is registered under its own file name, and that key is bound to an export of that file.
- Every rule has a spec beside it, and no spec sits beside no rule.
- Each spec names its own rule id and imports the file next to it.
- Every kind actually ran. A spec that throws while loading announces nothing, so its three kinds are
  absent rather than failing.
- Every rule header opens with its `Makes sure:` or `Shows:` claim.
- The `.oxlintrc.json` scoping agrees with `declared-trees.ts`, in both directions.
- The pre-commit lint glob covers exactly the extensions the layout calls source.
