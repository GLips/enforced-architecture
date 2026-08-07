# Rule fixture harness

Runs every oxlint rule template in `skills/enforced-architecture/references/rules/` against the specs that ship beside it, and fails CI when one stops behaving.

It proves the **chosen examples**, not the header claim in general. The specs and the rule come from the same author, so an unimagined violation spelling is unimagined in both. Treat a green run as "the contract I wrote down still holds", not as "this rule is correct."

```
bun run check:rules
```

## Why this exists

A rule's failure mode is silent by construction. When a rule stops matching it does not error — it approves everything, and a passing check is indistinguishable from a working one. Reviewing a rule by reading it does not catch this, because the reader shares the author's blind spot: the same reasoning that produced the gap reads straight past it.

Consuming projects can already test their rules, because they instantiate them. The skill could not, because it ships templates. Every defect it ships is multiplied by the number of projects that adopt it.

Moving from GritQL to oxlint changed which silences are possible but not that they exist. GritQL's was a snippet with no slot for a node real code carried, which compiled clean and matched nothing. A visitor's is a typo'd visitor key: it never fires, and nothing complains.

## The shape, and why this one

Each rule ships two files:

```
skills/enforced-architecture/references/rules/<tag>/<rule>.ts        the rule
skills/enforced-architecture/references/rules/<tag>/<rule>.test.ts   its specs
```

The spec imports the shipped rule directly, so there is no second copy of any rule and nothing to drift. That is possible because the templates are not placeholder-bearing, which is the thing worth knowing before touching this. They are concrete rules written against one standard layout — `src/domains`, `src/features/<name>/{controllers,repo,service,ui}`, `src/infrastructure`, `src/routes`, `src/shared/ui`, and the `@/` alias. Their **Adapt** sections document *alternatives* in prose; they do not mark holes that something has to fill.

**What this shape does not test:** whether a template survives adaptation. A project that repoints `/src/domains/` at `/src/core/` is on its own, and its own spec suite is what covers it — see *Rule Specs* in `references/enforcement-implementation.md`.

### Why the fixture trees are gone

This harness used to materialize `harness/fixtures/<tag>/<rule>/<kind>/` as a real source tree and lint it, because the rules read the path and Biome could only be pointed at files on disk. `RuleTester` takes `filename` as a field on each test case, so the path a rule reads is now one line in the spec rather than a directory to build. A 130-file tree earning nothing over a field is a tree that costs maintenance for no coverage, so it went.

The specs shipping *beside* the rules is the other half of the trade: a project stealing a rule from this catalog now steals its tests in the same copy.

## The three-kind contract

`describeRule` takes the three kinds as named arguments, so a missing one is a type error rather than a convention nobody checks:

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

Every case carries its own `filename`, in the standard layout, because the rules read the path. Invalid cases assert the diagnostic **count** as well as the message, so an over-match on an expected line fails too.

## What the runner checks that a spec run does not

`harness/run-rule-fixtures.ts` exists for the five things a spec cannot say about itself. Each one leaves a green run behind a rule nothing exercises:

- **`rules/plugin.ts` does not load.** The runner imports the manifest rather than grepping it, because a plugin that fails to load takes *every* rule silent with it — the largest version of the failure everything here guards against.
- **A rule missing from `rules/plugin.ts`, or bound to the wrong export.** The plugin module is the manifest a consuming project copies; a rule absent from it ships as a file nobody loads. Tested, and never run. A text search would pass a commented-out registration; an import does not.
- **A rule with no spec beside it.**
- **A spec pointed at the wrong rule** — it must call `describeRule("<its own id>", …)` and import the rule file beside it.
- **A kind that never ran.** The runner reads TAP result *names* rather than file results, because `describeRule` makes every kind announce itself as `<rule id> (<kind>)`. A spec that throws while loading reports no name at all, so its three kinds are simply absent — which is how a stubbed or deleted check gets caught instead of passing on zero cases.

`describeRule` itself rejects an empty kind at load time, which is the other half of that last one.

Every one of these was revert-probed when the runner was built. Do it again after any change here: break a rule and expect its adversarial kind to fail, stub a spec and expect all three kinds to report as never run. A harness that stays green through both is not testing anything.

What it still does not check is whether **oxlint** accepts the plugin, as opposed to Node loading it. That path was verified by hand — all 31 rules enabled against a probe tree through the real CLI — and JS plugins being alpha is the reason to re-verify it after an oxlint upgrade rather than trusting a green `check:rules`.

## The runtime: real Node, not Bun

`check:rules` goes through `harness/with-real-node.sh`, and that is not incidental.

`RuleTester` does not parse in JS. It parses in Rust and shares the AST through a zero-copy buffer ("raw transfer"): a 2 GiB view aligned to a 4 GiB boundary means allocating 6 GiB and carving the aligned slice out of the middle. JavaScriptCore cannot allocate an `ArrayBuffer` that large, so oxlint refuses Bun **by name**, with no slower path to opt into. The `oxlint` CLI itself is fine under Bun; this binds only the rule-authoring path.

The trap is the error message. Bun puts a `node`-named symlink to *itself* on PATH (`/tmp/bun-node-*/node`) ahead of the real binary for every process it spawns, so `node --test` in a Bun-spawned shell — which is where coding agents run — is Bun wearing node's name. The specs then die with `Cannot use describe outside of the test runner`, which names the test framework and points nowhere near the cause. The launcher drops those PATH entries so `node` means node.

Verified on oxlint 1.77.0 / bun 1.3.13 / Node 24.17.0. Re-check whether JavaScriptCore has gained large `ArrayBuffer` support before carrying the workaround forward.

## Scope

The 31 rule templates are covered. The 17 `.md` templates describe structural-script algorithms rather than shipping runnable code, so there is nothing here to load — they are marked **Not spec-tested** in `rules/overview.md`, with the reason. Implementing them here would make this repo the implementation under test rather than the templates.

`harness/parked/script-tier-fixtures/` holds 38 adversarial fixtures for that script tier, lifted out of a consuming project. They are parked, not wired: this harness runs templates unmodified and those scripts are adapted instantiations. Read the README there before touching them.
