# Documentation Model

What to write down beyond what the rules enforce, where to put it, and how to stop it growing.

---

## Why Document at All

Enforcement catches a violation after the code is written. Documentation shapes the decision before
it. The gap between them is every judgment a rule cannot make: when a service layer is warranted,
when a layer would be a trampoline, which barrel an export belongs in, when three occurrences have
become a pattern.

The rule is the safety net. The doc is the guardrail. Do not write a doc that restates a rule — the
error message already says it, with the offending path filled in.

---

## Choice: Documentation Depth

| Option | What gets generated |
|---|---|
| **CLAUDE.md only** | One "Rules of the Road" section, terse and decision-ready. Enough for a small project whose architecture fits in a screenful. |
| **CLAUDE.md + `docs/architecture/`** | CLAUDE.md gets the terse rules. `docs/architecture/` gets the reasoning, the examples and the trade-offs. |

**Recommendation:** take both when the project has layered features or a domains layer. CLAUDE.md
stays short, because agents read it on every task. `docs/architecture/` carries depth for the moments
an agent is designing rather than typing.

---

## CLAUDE.md

Terse, imperative, decision-ready. An agent should read it in under a minute and place code
correctly.

Always include:

| Section | Content |
|---|---|
| Commands | Build, test, lint, typecheck, migrations. Copy-pasteable. |
| Dependency direction | The invariant and the layer order. |
| Declared trees | Which source roots the catalog governs, and what is deliberately outside them. |
| Barrel convention | `index.ts` versus `index.server.ts`, and what goes in each. |
| Server and client naming | A `createServerFn` file uses a plain `.ts` name. Raw server helpers use `.server.ts`. |
| Route imports | A route imports a feature's barrel or its `ui/` subtree, and nothing deeper. Which barrel depends on the route file's own name. |
| Cross-feature imports | The importee grants each consumer in its `visibility.json`, with a reason. |
| Test placement | `thing.test.ts` beside `thing.ts`. |

Include based on the choices made:

| Choice | Content to add |
|---|---|
| Layered features | The layer order, directory-wide occupancy, graduation triggers. |
| Domains layer | The purity constraint, and how a controller wires a domain function to infrastructure. |
| Error convention | One class with typed codes, or per-layer errors. Include a short example. |
| SDK containment | The procedure for adding one, and which packages have no row. |
| Extraction threshold | The number — typically three — at which code moves to `shared/`. |

Document these four, because no rule catches them:

| Rule | Why it is not mechanical |
|---|---|
| No trampolines | The check reports and does not block. False positives exist. |
| Do not abstract `createServerFn` | The failure shape — a factory wrapping the call — is too varied to match. |
| Extraction threshold | It needs counting across features, and nothing counts it. |
| No empty directories | Creating a directory is not an import, so no import rule sees it. |

**Tone.** Imperative voice: "Features use X," not "Features should use X." No rationale in CLAUDE.md
— agents need rules, not persuasion. Include a code example only where the convention is not obvious
from the sentence. And say that lint and CI enforce this, so an agent knows a violation will be
caught.

---

## `docs/architecture/`

Expanded material for structural decisions. One file per concern, not one monolith. Each file is
referenced from CLAUDE.md through a "read when" table.

| File | Content | Read when |
|---|---|---|
| `feature-patterns.md` | Scaling tiers with examples from this project. Graduation triggers. Layer responsibilities. | Adding or graduating a feature |
| `boundaries.md` | What the import table does *not* answer: the extraction threshold, which SDKs are wrapped and which are left unconstrained, which trees are declared and what is outside them. | A boundary question the error message did not settle |
| `server-client-boundaries.md` | Bundle splitting. What `.server.ts` means here. How the compiler handles server functions. | Working on server and client splitting |
| `error-conventions.md` | The error architecture and how controllers map codes to status. | Adding error handling |
| `decisions.md` | Which configurable choices were made, and why. Links to the plan. | Understanding why the architecture is shaped this way |

**Do not write a file that renders the import boundary matrix.** The table in `lint/policy/` is the
only statement of those decisions, and each denial prints the reasoning for the position it denied
with this project's directory names in it. A rendered copy costs more words than any budget here
allows and goes stale on the first cell that moves.

For a smaller project, a two-file split also works: `reference.md` for the structure and
`conventions.md` for how to write code inside it. Choose whatever keeps a file short enough to read
in one pass.

### How-to guides

A guide is followed as a checklist, which is a different job from a reference read for
understanding. Put them in `docs/architecture/how-to/`, one task per guide, each ending in a
verification checklist.

| Guide | Content |
|---|---|
| `new-feature.md` | Minimum feature structure, adding each layer, barrel setup, error types, `visibility.json` |
| `new-infra-adapter.md` | Adapter placement, the package-owners row, env vars, the barrel-purity list, client-safe exceptions |

Add more as patterns emerge. Good candidates: adding a domain module, promoting code to `shared/`,
graduating a feature.

**Do not put in `docs/architecture/`:** rule implementation details, which live in the rules; commands
and quick reference, which live in CLAUDE.md; or business logic documentation, which belongs to the
feature.

---

## Word Budgets

Every doc above is one that agents read while deciding where code goes, and therefore one that agents
keep appending to. Each addition is defensible on its own: a clarifying paragraph, a worked example,
a note about the case that just came up. Nothing is ever removed. The CLAUDE.md section written to be
read in a minute becomes the one that is skimmed. The reference written to be consulted becomes the
one that is grepped and abandoned.

Nothing in the enforcement tiers notices, because length violates nothing. So budget it.
`docs/doc-budgets.manifest.json` maps each standing doc to a word ceiling, and
[health/doc-budgets](lint/structural/health/doc-budgets.ts) fails the build on five conditions.

- **Over the ceiling.** Condense the doc, or move the material to the doc that owns it.
- **More than 5% of slack under the ceiling.** This is the ratchet, and it is the half that does the
  work. A doc that gets condensed otherwise leaves its old ceiling behind, and that headroom is room
  the next agent expands into with nothing to show in a diff. Reclaiming it in the same change costs
  one number and puts it in the hands of whoever just did the shortening.
- **A budgeted path with no file there.** A ceiling over a deleted doc is a budget nobody spends.
- **A ceiling that is not a positive integer.** It budgets nothing while reading as coverage.
- **A manifest that is absent or does not parse.** Every doc it names would otherwise go uncounted
  while the check reports clean.

So a ceiling only ever moves down by itself. Raising one is possible and deliberately conspicuous: a
line in the manifest, in the commit that needed the room, carrying the reason. That is the whole
mechanism. No check can tell dense prose from filler, and this one does not try. It forces the trade
to be made by someone rather than deferred forever.

**Budget the standing docs only** — CLAUDE.md and the `docs/architecture/` files. Those are read on
every task, so their length has a per-task cost. Plans, ADRs, changelogs and feature READMEs are
written once and appended to by design; a ceiling on them is friction that buys nothing.

Set the first ceilings from what the docs already weigh:

```
bun lint/structural/health/doc-budgets.ts --list docs/doc-budgets.manifest.json
```

That prints usage against ceiling and decides nothing — no findings, no verdict, exit 0 whatever it
shows. Doc paths inside the manifest resolve against the working directory, so run it from the
project root.

---

## Generating the Docs

Documentation is written by the implementing agent, from the plan, once the rules and the directory
structure are in place. It is not a phase of its own.

1. Generate the CLAUDE.md section.
2. Generate the `docs/architecture/` files, if that choice was made.
3. Write `docs/doc-budgets.manifest.json` from what those files weigh.
4. Read the generated CLAUDE.md as an agent seeing the project for the first time. Can you answer
   "where does this code go?" for any kind of work? If not, the gap is in the docs, not in the
   reader.

If CLAUDE.md already exists, add the architecture rules as a new section and leave the existing
content alone. If it does not, create it with a commands section and an architecture section.

CLAUDE.md should point at the deeper files:

```markdown
| Doc | Read when |
|-----|-----------|
| `docs/architecture/feature-patterns.md` | Adding or graduating a feature |
| `docs/architecture/boundaries.md` | A boundary question the error message did not settle |
| `docs/architecture/how-to/new-feature.md` | Creating a new feature |
```

That keeps CLAUDE.md terse while giving an agent a path to depth. How-to guides earn their place
here: agents follow a procedure more reliably than they synthesize one from reference material.
