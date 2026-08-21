# Rule fixture harness

Runs every rule in `skills/enforced-architecture/references/lint/` against the cases that prove it, and fails CI when one stops behaving.

It proves the **chosen examples**, not the header claim in general. The cases and the rule come from the same author, so an unimagined violation spelling is unimagined in both. Treat a green run as "the contract I wrote down still holds", not as "this rule is correct."

```
bun run check          # types then fixtures, both tiers
bun run typecheck      # both tier programs, under the tsconfigs the skill hands out
bun run check:rules    # oxlint rules, under real Node
bun run check:no-reflect-access-live  # ONE rule, through the real oxlint CLI — see below
bun run check:structural  # structural checks, under Bun
```

`typecheck` is not this harness's and does not overlap with it. A fixture run proves what a
template *does*; only a compiler proves it is typed, and a template with a type error passes every
`RuleTester` case — `context.options[0]?.threshold` reading `undefined` compares every count
against NaN and governs nothing while running green. It is in `check` because the catalog ships
tsconfigs telling an adopting repo to gate on exactly these programs, and a catalog that fails the
gate it hands out is a catalog nobody should copy.

Two runners because the two tiers read differently, not because the standard differs. Each runner owns one directory — `lint/oxlint/` and `lint/structural/` — so neither has to ask which tier a file belongs to; the path already said. An oxlint rule is handed one file, so it is exercised through `RuleTester` against inline sources. A structural check scans declared roots and several scan more than one, so its cases are real files in one shared tree. Both are held to the same three-kind contract below. The structural side has its own README at [structural-fixtures/README.md](structural-fixtures/README.md); the rest of this file is the oxlint side plus what the two share.

## Why this exists

A rule's failure mode is silent by construction. When a rule stops matching it does not error — it approves everything, and a passing check is indistinguishable from a working one. Reviewing a rule by reading it does not catch this, because the reader shares the author's blind spot: the same reasoning that produced the gap reads straight past it.

Consuming projects can already test their rules, because they instantiate them. The skill could not, because it ships templates. Every defect it ships is multiplied by the number of projects that adopt it.

Moving from GritQL to oxlint changed which silences are possible but not that they exist. GritQL's was a snippet with no slot for a node real code carried, which compiled clean and matched nothing. A visitor's is a typo'd visitor key: it never fires, and nothing complains.

## The shape, and why this one

Each rule ships two files:

```
skills/enforced-architecture/references/lint/oxlint/<tag>/<rule>.ts        the rule
skills/enforced-architecture/references/lint/oxlint/<tag>/<rule>.test.ts   its specs
```

The spec imports the shipped rule directly, so there is no second copy of any rule and nothing to drift. That is possible because the templates are not placeholder-bearing, which is the thing worth knowing before touching this. They are concrete rules, and the layout they read — `src/domains`, `src/features/<name>/{controllers,repo,service,ui}`, `src/infrastructure`, `src/routes`, `src/shared/ui`, the `@/` alias — is the RECOMMENDED vocabulary in `lint/policy/declared-trees.ts` rather than anything spelled in a rule. Their **Adapt** sections document *alternatives* in prose; they do not mark holes that something has to fill.

**What this shape does not test:** whether a template survives adaptation. These specs are written against the recommended vocabulary, so a project that renames `domains/` to `core/` in its tree's vocabulary is on its own, and its own spec suite is what covers it — see *Rule Specs* in `references/enforcement-implementation.md`.

### Why the fixture trees are gone

This harness used to materialize `harness/fixtures/<tag>/<rule>/<kind>/` as a real source tree and lint it, because the rules read the path and Biome could only be pointed at files on disk. `RuleTester` takes `filename` as a field on each test case, so the path a rule reads is now one line in the spec rather than a directory to build. A 130-file tree earning nothing over a field is a tree that costs maintenance for no coverage, so it went.

The specs shipping *beside* the rules is the other half of the trade: a project stealing a rule from this catalog now steals its tests in the same copy.

## The three-kind contract

Both tiers hold to it. On the oxlint side `describeRule` takes the three kinds as named arguments, so a missing one is a type error rather than a convention nobody checks; on the structural side the same three names are fields of a `CheckFixtures` object and the runner rejects an empty one:

```ts
import { describeRule } from "../lib/rule-spec.ts";
import { dbIsolationRule } from "./db-isolation.ts";

describeRule("boundary/db-isolation", dbIsolationRule, {
  obvious: [ /* RuleTester invalid cases */ ],
  adversarial: [ /* RuleTester invalid cases */ ],
  legal: [ /* RuleTester valid cases */ ],
});
```

1. **obvious** — the violation the rule's own header names.
2. **adversarial** — the same violation written the way the rule's natural pattern misses. This is the case that decides whether the rule works, and the one an author writing their own spec will not think of. For an import fence: a dynamic `import()`, a re-export, a star re-export, a type-only import, and a path that merely *looks* exempt (`legacy-repo/` is not `repo/`). Segment-boundary over-matching was the single most common defect in the GritQL catalog — five rules had it.
3. **legal** — code that looks like the violation and is allowed. Over-matching is invisible to positive cases, and it is the defect that trains people to ignore the rule.

The structural side carries a fourth field, optional and unlike the other three: **`messages`**, a list of `{ path, contains }` and `{ path, absent }` entries asserting what a finding SAYS. The three kinds above compare paths and severities, which catches a matcher that stopped matching; nothing there can catch a message that stopped saying something — and a message is what a blocking check delivers. Where a branch exists only to change the wording, the path comparison is identical with the branch working and with it deleted, so the guard is green because no fixture asked. `absent` is the half that is easy to skip and does the real work: it is the only way to state that a branch is NARROW, since a paragraph written for one reader and delivered to every reader passes every positive assertion there is. `boundary/layer-occupancy` is the worked example — it argues the type-import case only to the reader who wrote one.

Every case carries its own `filename`, in the standard layout, because the rules read the path. Invalid cases assert the diagnostic **count** as well as the message, so an over-match on an expected line fails too.

## What the runner checks that a spec run does not

`harness/run-rule-fixtures.ts` exists for the six things a spec cannot say about itself. Each one leaves a green run behind a rule nothing exercises:

- **`oxlint/plugin.ts` does not load.** The runner imports the manifest rather than grepping it, because a plugin that fails to load takes *every* rule silent with it — the largest version of the failure everything here guards against.
- **A rule missing from `oxlint/plugin.ts`, or bound to the wrong export.** The plugin module is the manifest a consuming project copies; a rule absent from it ships as a file nobody loads. Tested, and never run. A text search would pass a commented-out registration; an import does not.
- **A rule with no spec beside it.**
- **A spec pointed at the wrong rule** — it must call `describeRule("<its own id>", …)` and import the rule file beside it.
- **A kind that never ran.** The runner reads TAP result *names* rather than file results, because `describeRule` makes every kind announce itself as `<rule id> (<kind>)`. A spec that throws while loading reports no name at all, so its three kinds are simply absent.
- **A kind that ran zero cases.** `RuleTester.run` on an empty scenario emits the suite line and nothing under it, so announcing a kind is not running one. The runner counts each kind's leaf cases as well as reading its name.
- **`describeRule` no longer refusing an empty kind.** That refusal is what makes a stubbed spec a load error, and every shipped spec is populated, so deleting it changes no output anywhere. The runner calls `describeRule` with one kind emptied and demands a refusal that names it.

The last two are independent holds on one invariant: the probe fails when the refusal goes, the count fails when a case list is emptied after it. Removing both together is what a stub needed to pass, and it did — PASS, 50/50, exit 0.

Every one of these was revert-probed when it landed. Do it again after any change here: break a rule and expect its adversarial kind to fail; stub a case list and expect three kinds never run; delete the refusal and expect the probe to fail; do both and expect zero cases. A harness that stays green through any of those is not testing anything.

What it still does not check is whether **oxlint** accepts the plugin, as opposed to Node loading it. That path is verified by hand, and was last redone when the full rule manifest landed: every rule enabled against a probe tree through the real CLI. Nothing re-runs it. JS plugins being alpha is the reason to redo it by hand after an oxlint upgrade rather than trusting a green `check:rules`.

## The host gap, and the one rule that is proved through it

`RuleTester` is not the linter. It parses the same source with the same rule, and it does not build the same environment: **no global scope is populated**. So a rule that reasons about globals gets a different answer in the two hosts, and the spec is written in the host where the answer happens to be the one the author expected.

`types/no-reflect-access` is the measured case. It asked "does any enclosing scope bind `Reflect`?" and read a hit as a local shadow. Under the CLI the global scope binds `Reflect`, so every use answered yes and the rule reported nothing at all — shipped, registered, enabled nowhere, and green across all fifteen of its specs. Two spellings of the question were available and each is wrong in one host: `sourceCode.isGlobalReference` answers `true` under the CLI and `false` under RuleTester for the same identifier (oxlint 1.77.0, both measured). The fix reads the resolved binding's **definition site**, which agrees in both.

`harness/prove-no-reflect-access-live.ts` is what proves it: files materialized on disk, linted by the real `oxlint` binary through the shipped `plugin.ts`, diagnostics read back. It covers one rule on purpose and says so in its header.

**Every other rule in the catalog carries the same blind spot**, and a green `check:rules` does not mean a rule fires in the linter.

Generalizing the live run across the tier was proposed and **dismissed**, so do not wait for it. Every rule's obvious fixtures were materialized as real files and linted through the shipped `.oxlintrc.json` once, by hand, when the full manifest landed: all of them reported their own diagnostic id. That one-off covered the inert-rule class and the registration-versus-enablement gap for every fixtured rule, which was most of what a standing pass would buy. What a standing pass would still add is a sweep for the scope class this section describes, and nobody has a second instance of it. Adopting the catalog on a real repo is the live proof instead. Revisit this only if an adoption turns up a rule that is green here and silent in the linter.

## The runtime: real Node, not Bun

`check:rules` goes through `harness/with-real-node.sh`, and that is not incidental.

`RuleTester` does not parse in JS. It parses in Rust and shares the AST through a zero-copy buffer ("raw transfer"): a 2 GiB view aligned to a 4 GiB boundary means allocating 6 GiB and carving the aligned slice out of the middle. JavaScriptCore cannot allocate an `ArrayBuffer` that large, so oxlint refuses Bun **by name**, with no slower path to opt into. The `oxlint` CLI itself is fine under Bun; this binds only the rule-authoring path.

The trap is the error message. Bun puts a `node`-named symlink to *itself* on PATH (`/tmp/bun-node-*/node`) ahead of the real binary for every process it spawns, so `node --test` in a Bun-spawned shell — which is where coding agents run — is Bun wearing node's name. The specs then die with `Cannot use describe outside of the test runner`, which names the test framework and points nowhere near the cause. The launcher drops those PATH entries so `node` means node.

Verified on oxlint 1.77.0 / bun 1.3.13 / Node 24.17.0. Re-check whether JavaScriptCore has gained large `ArrayBuffer` support before carrying the workaround forward.

## Scope

Every rule in the catalog has cases: the oxlint rules through `check:rules`, the structural checks through `check:structural`. Nothing ships as an untested description any more.

Having cases is not the same as being proved to FIRE, and the section above is the difference. One oxlint rule — `types/no-reflect-access` — is additionally run through the real linter on every `bun run check`. The other 48 are proved on every run only in `RuleTester`'s environment, which is not the one an adopting project runs. Each of them was linted through the real CLI once, by hand, when the full manifest landed; nothing re-checks that.

The structural tier used to be prose. Each consuming project hand-rolled an implementation from the algorithm in the `.md`, and three independent audits found the same result: the implementations drifted, and each one had silently stopped matching part of what its doc promised. One deployment's layer-occupancy check had three bypasses and hardcoded a path its own doc documented as configurable; another's barrel-purity discovered a third of the barrels it claimed to. Every one of those was green. That is the argument for shipping code and config rather than an algorithm — the adaptation step is where the silence was getting in, so the adaptation step is now writing config.

What is still not covered, for either tier: whether a rule survives **adaptation**. Renaming a directory, moving a source root, or moving a threshold is unverified work in the consuming project — the catalog's specs are written against the recommended vocabulary, not that project's — so the project writes its own specs in the same change. Repointing a rule at a different path is not on that list, because it is not on offer: no rule takes a pattern as configuration. See *Rule Specs* in `references/enforcement-implementation.md`.

## The catalog under its own doc ratchet

`bun run check:doc-budgets` runs the shipped `health/doc-budgets` check against this repository, with ceilings in `docs/doc-budgets.manifest.json`. It imports the shipped check rather than counting words itself, so the ratchet the catalog ships and the ratchet the catalog lives under cannot disagree.

It budgets the standing prose: `CLAUDE.md`, `README.md`, this file, `SKILL.md` and the eight files under `references/`. It deliberately budgets neither the per-tag `references/lint/**/overview.md` indexes, whose length is a function of the rule count rather than of prose, nor rule header comments, which are code and belong to `health/file-size`.

The ratchet fires in both directions: a doc that grows past its ceiling fails, and a doc that shrinks without its ceiling following fails as well. All three failing statuses — over, slack, and a ceiling over a file that is not there — were probed live against this manifest, not assumed.

