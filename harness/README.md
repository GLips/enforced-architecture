# Rule fixture harness

Runs every GritQL rule template in `skills/enforced-architecture/references/rules/` against fixtures, and fails CI when one stops behaving.

It proves the **chosen examples**, not the header claim in general. The fixtures and the rule come from the same author, so an unimagined violation spelling is unimagined in both. Treat a green run as "the contract I wrote down still holds", not as "this rule is correct."

```
bun run check:rules
```

## Why this exists

A rule's failure mode is silent by construction. When a rule stops matching it does not error — it approves everything, and a passing check is indistinguishable from a working one. Reviewing a rule by reading it does not catch this, because the reader shares the author's blind spot: the same reasoning that produced the gap reads straight past it.

Consuming projects can already test their rules, because they instantiate them. The skill could not, because it ships templates. Every defect it ships is multiplied by the number of projects that adopt it.

## The shape, and why this one

The harness runs each `.grit` template **unmodified** as the Biome plugin under test. There is no second copy of any rule, so there is nothing to drift.

That is possible because the templates are not placeholder-bearing, which is the thing worth knowing before touching this. They are concrete rules written against one standard layout — `src/domains`, `src/features/<name>/{controllers,repo,service,ui}`, `src/infrastructure`, `src/routes`, `src/shared/ui`, and the `@/` alias. Their **Adapt** sections document *alternatives* in prose ("`.*/src/core/.*` if you call your domain layer core"); they do not mark holes that something has to fill. So a fixture tree that reproduces the standard layout runs the template as written.

The alternative shape — a reference project that instantiates every template, with fixtures beside it — tests the rules as adapted, which is closer to how they are used. It was rejected for the cost the ticket named: a second copy of every rule that can drift from the template, and nothing checking the drift. Here the artifact under test *is* the artifact that ships.

**What this shape does not test:** whether a template survives adaptation. A project that repoints `.*/src/domains/.*` at `.*/src/core/.*` is on its own, and its own fixture suite is what covers it — see *Rule Fixtures* in `references/enforcement-implementation.md`.

## Layout

```
harness/fixtures/<tag>/<rule-name>/<kind>/<a real source tree>
```

`<kind>` is `obvious`, `adversarial`, or `legal`, and all three are mandatory — the harness refuses a set that is missing one.

1. **obvious** — the violation the rule's own header names.
2. **adversarial** — the same violation written the way the rule's natural pattern misses. This is the case that decides whether the rule works, and the one an author writing their own fixture will not think of.
3. **legal** — code that looks like the violation and is allowed. Over-matching is invisible to positive fixtures, and it is the defect that trains people to ignore the rule.

Below `<kind>` the path is a real source tree, because the rules read the path. The kind is a directory rather than a filename prefix because several rules match an exact filename (`index.ts`, `theme.ts`).

## Expectations

Markers live in the fixture beside the code they describe:

```ts
// EXPECT: a named re-export carries the same runtime dependency an import does
export { Stripe } from "stripe";

// EXPECT+2: a dynamic import is a call expression, invisible to JsModuleSource
export const load = async () =>
  await import("@sentry/node");

// EXPECT x2: Biome reports a sole object member with a trailing comma twice
fontSize: 13,
```

- `EXPECT:` — one diagnostic on the next line.
- `EXPECT+N:` — one diagnostic N lines below, for statements whose reported span (the module source, the JSX attribute) is not on the line the statement starts on.
- `EXPECT xN:` — N diagnostics on that line. Only for shapes Biome genuinely double-reports; writing it to silence a surprise hides the surprise.

Keep the note on one line. A marker aimed at a blank or comment-only line is rejected, because that is always an authoring slip.

A `legal/` file carrying any marker is rejected, and so is an `obvious/` or `adversarial/` case carrying none — a violation fixture with no marker would pass whether or not the rule ever fired.

The suite asserts the diagnostic set **exactly**. A missing one is reported as UNDER-MATCHED, an extra one as OVER-MATCHED.

## What the runner checks that a lint run does not

Both of Biome's plugin-load failures are silent in ordinary use, and each gets its own detection so it does not surface as "every expected diagnostic is missing":

- **Compile failure** (a `#` comment, a misspelled node name, a bare top-level `$program <:`) writes no JSON at all. Note that a *snake_case* node name like `call_expression()` is **not** one of these — it compiles and matches.
- **Runtime failure** (the regex-capture-group trap) is reported at severity `info`. The build stays green and the rule reports nothing, forever. This is the failure the harness was built for.

One plugin per Biome run. Biome files every plugin diagnostic under the bare category `plugin` with no rule name attached, so loading two at once makes attribution impossible — and a rule firing for the wrong reason is exactly what this exists to catch.

Any diagnostic Biome reports that is *not* from the plugin means the fixture itself is broken, and fails the rule. A fixture under no rule's directory fails too: renaming a template without moving its fixtures would otherwise read as full coverage.

## Scope

The 31 `.grit` templates are covered. The 16 `.md` templates describe structural-script algorithms rather than shipping runnable code, so there is nothing here to load — they are marked **Not fixture-tested** in `rules/overview.md`, with the reason. Implementing them here would make this repo the implementation under test rather than the templates.
