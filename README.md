# Ship fast without turning your codebase into slop. Encode your data flow and structural boundaries as automatically enforced lint rules.

A catalog of ~50 ready-to-steal enforcement rules for TypeScript codebases. Point your agent here to steal them directly, or to get inspiration for your own codebase.

## Principles, briefly

- **If a constraint isn't enforced by tooling, it doesn't exist.** The rules teach amnesiac agents by blocking them from doing wrong things.
- **Predictable structure enables autonomous navigation.** An agent should answer "where does this code live?" from the directory layout alone.
- **Anti-ceremony.** The goal is the *minimum* structure that protects your dependency invariants. Layers are optional — but if a layer exists, you can't bypass it. No empty directories, no scaffolding or boilerplate for hypothetical needs.
- **Blocking from day one.** Agents treat warnings like "it's fine." Every rule either blocks or isn't a rule yet.

The full reasoning lives in [`architecture-principles.md`](skills/enforced-architecture/references/architecture-principles.md).

## The idea

Agents are prolific. It's like having an army of interns.

But you can't be confident they're adhering to your codebase's conventions with documentation alone.

Hard rules that *block* bad behavior are *authoritative*. An agent writes something incorrectly, gets an error, and changes course to do it the right way.

This is heavily inspired by OpenAI's [harness engineering](https://openai.com/index/harness-engineering/) writeup, where their team shipped a 1M line codebase with essentially zero hand-written code by leaning on layered domains, fixed dependency direction, and custom linters with agent-targeted error messages. As they put it:

> "This is the kind of architecture you usually postpone until you have hundreds of engineers. With coding agents, it's an early prerequisite — the constraints are what allow speed without decay or architectural drift."

Enforce boundaries centrally, allow autonomy locally.

## What a rule looks like

Rules are small and self-documenting. The error message *is* the fix instruction — an agent can resolve a violation without reading anything else. For example, "the database is off-limits outside the data-access layer":

```
DB client/schema imports are restricted to infrastructure/*, features/*/repo/*,
and features/*/controllers/*. Move this DB access to a repo or controller module.
```

That single boundary kills an entire class of bugs because the import simply can't exist outside the layer that's allowed to have it.

The catalog covers boundaries like that, plus public-API barrels, SDK containment, server/client splitting, file placement, dependency-cycle detection, file-size limits, and a set of React code-smell checks (derived state, direct `fetch` in components, async effects without cleanup, and more). Most are [oxlint](https://oxc.rs/docs/guide/usage/linter) JS-plugin rules that run per-file in real time; a few are cross-file scripts that run pre-commit.

## The rules are tested

A lint rule fails silently. When it stops matching it doesn't error — it goes green, and a passing check looks exactly like a working one. That's how you end up with a boundary everyone believes is enforced and nothing behind it.

So every lint rule in this repo ships with a spec file beside it, and that spec has to cover three kinds of case: the obvious violation, the *adversarial* one written the way the rule is likely to miss, and a legal neighbour that must stay silent (over-matching is what trains people to ignore a rule). The specs run in CI, and the harness fails the build on a rule with no spec, a spec with an empty kind, or a rule that never got registered. Edit a rule and break it, the build fails.

Putting the spec beside the rule rather than in a separate fixture tree is the part worth copying: rule and evidence are one unit, so a project taking `boundary/db-isolation.ts` gets `boundary/db-isolation.test.ts` in the same grab, and can prove the rule still fires after adapting the paths to its own tree.

This found real bugs. Eleven of the thirty-one rules had a behavioural defect the first time it ran, and one more carried a false explanation of itself. Worth being precise about severity, because "broken" oversells it: **none was a dead no-op.** Every one of the eleven still caught the violations it was aimed at. Five were *over*-matching (`@/features.*` also hit `@/features-legacy`), two reported a duplicate on the import line, two surfaced one finding per run instead of all of them, one missed two export forms — and exactly one was inverted, reporting the *correct* spelling while missing the incorrect one.

The defects also weren't independent: they trace to about four misconceptions copied across templates. That's the real lesson — a shared idiom propagates its bug everywhere it's pasted. All of these had been reviewed by reading. Reading doesn't work; the reviewer has the same blind spot as the author.

Details in [`harness/README.md`](harness/README.md). Steal the approach along with the rules — it's the part that keeps them honest.

## How to use this repo

**1. Steal the rules/run the skill.** If you run a Tanstack Start + Drizzle setup, the rules may be directly applicable. Tell your agent to crib what it can from the repo.

**2. Point your agent at it for ideas.** This is what most people should do. The rules here target a specific stack, but the *thinking* is universal. Hand this repo to your coding agent and ask it to figure out which boundaries matter for *your* codebase — then write the enforcement rules in whatever your project uses (oxlint, ESLint, ArchUnit-style fitness functions, custom scripts). The catalog is a menu of ideas as much as a set of files.

## Installation

Install the skill with the `skills` CLI:

```bash
npx skills add GLips/enforced-architecture
```

But seriously you should probably just copy the repo link and point your agent here. The ideas are the most important parts.

## Stack note

The rule templates target Bun, TanStack Start, oxlint, Drizzle, Postgres, React, Zod, and lefthook. If you're on a different stack, the architectural principles still apply — translate the patterns to your framework and tooling (your agent is good at this).

## License

MIT
