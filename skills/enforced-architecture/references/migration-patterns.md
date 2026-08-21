# Migration Patterns

How to move an existing codebase onto the enforced architecture: what to sequence, and what to
verify.

---

## What a Migration Sequences

**It does not sequence which rules run.** The catalog arrives whole. `lint/oxlint/plugin.ts` and the
`rules` block of [setup/oxlintrc.json](setup/oxlintrc.json) are one list wearing two hats, and a
config key naming a rule the plugin does not export is fatal — oxlint refuses the whole config and
lints nothing. So you cannot stage adoption by registering a subset.

A migration sequences **which violations you clear**. Every rule is on from the first commit, and the
first `check:arch` run prints the whole list. That list is the migration plan. Work it inside-out,
and wire the commit gate last.

Expect the first run on a legacy tree to be dominated by one finding: `boundary/import-policy`
reports `unclassifiedSource` for every file inside a declared tree that sits in no area the layout
knows. Moving files into areas is therefore the first work, not an afterthought.

---

## Setup Phase

No violations are fixed here. The tools exist and print a list.

1. Copy `lint/policy/` and declare this project's source roots in `lint/policy/declared-trees.ts`.
2. Copy `lint/oxlint/` and `lint/structural/` whole, and copy `.oxlintrc.json` from the shipped
   manifest.
3. Add `check:arch` to `package.json`. Run `oxlint` and the structural checks as two independent
   commands and aggregate their exit codes. Do not chain them with `&&`: the first failure would
   hide every finding behind it.
4. **Do not wire the commit gate yet.** `lefthook.yml` and the CI job land in the last phase, when
   the tree can pass them.

Run `check:arch`. Keep the output. It is the only artifact this phase produces.

---

## Change Classification

Classify every fix in the list as one of two kinds, and separate them in the plan.

**Mechanical** — file moves, import rewrites, barrel creation. A codemod or a search-and-replace does
it. Batch these aggressively in one commit.

**Judgment-required** — logic refactoring, API redesign, dependency inversion, and every question of
the form "which feature owns this code?". Each needs its own commit and its own reason.

---

## Sequencing: Inside-Out

Clear violations from the foundation outward. Each group below assumes the one above it is done.

| # | What this phase makes true | Findings it clears | The judgment inside it |
|---|---|---|---|
| 1 | Every file sits in an area the layout knows | `unclassifiedSource`, `unclassifiedTarget` | Which area each stray file belongs to. A file that fits none is a new area to decide, not a file to exempt |
| 2 | Only designated modules reach the database | `boundary/db-isolation`, `placement/schema-placement` | Per query: move it into a repo module, into a controller, or behind a new server function |
| 3 | External SDKs are reached through adapters | `boundary/sdk-containment`, `boundary/client-server-infra` | Which SDKs to wrap, and what each wrapper's API is |
| 4 | Features expose public APIs through barrels | `boundary/import-policy` exposure findings, `api/barrel-direction`, `api/server-import-context` | What each feature's public API should hold |
| 5 | Imports that leave a unit use `@/` | `crossingSpelledRelatively` | None. This one is mechanical end to end |
| 6 | Files live in the right layer, and direction holds | `placement/layer-direction`, `placement/server-fn-placement`, `boundary/route-thinness`, `boundary/server-no-upward` | A `createServerFn` outside `controllers/` may have to be split before it can move. Domain logic with side effects has to land in a feature or in infrastructure |
| 7 | Cross-file constraints hold | `graph/domain-cycles`, `graph/feature-deps`, `api/barrel-purity`, `boundary/layer-occupancy`, `health/file-size`, `health/trampolines` (warning) | Splitting oversized files, breaking cycles, routing an edge that skips an occupied layer back through it |
| 8 | The gate blocks | none left | None. Copy `lefthook.yml`, add the CI job, and confirm both run red on a deliberate violation |

Why inside-out: each group's fix changes the paths the next group matches. A file that moves in phase
6 has a different import path, so fixing its alias spelling in phase 5 first would be work done
twice. And a feature calling the database directly violates two rules at once; fixing the
foundational one removes both findings.

---

## What Each Phase Records

| Field | Content |
|---|---|
| **Goal** | One sentence. What is true at the end that was not true at the start? |
| **Findings cleared** | The diagnostic ids this phase drives to zero |
| **Changes** | Every fix, marked mechanical or judgment |
| **Verification** | `check:arch`, `typecheck`, `test` and `dev`, each run on its own. Chain them with `&&` and the first failure hides the rest |
| **No shims** | No temporary compatibility layer, no re-export that exists only to avoid updating an import |

---

## Read the Zero Carefully

A finding count that drops to zero has two causes: you fixed the code, or the rule stopped matching.
The two look identical.

So treat the violation list as evidence about the rules as well. A rule that reported nothing on the
legacy tree at the start is a rule to suspect, not a rule to celebrate — a legacy codebase that
violates none of a rule's subject is rare. Check the rule's adversarial case before you accept the
zero.

---

## Common Pitfalls

**Fixing violations in the wrong order.** A file with both an alias violation and a layer-direction
violation gets its layer fixed first. Moving the file changes its import path, which changes the
alias fix.

**Not verifying after each phase.** Findings compound. A missed import rewrite surfaces two phases
later as something that looks unrelated.

**Creating a shim "temporarily."** It becomes permanent. Each phase is complete in itself.

**Moving files without updating every import.** Run `typecheck` after any move. It catches what grep
misses.

**Wiring the commit gate early.** A gate that fails on every commit for two weeks teaches everyone to
pass `--no-verify`, and that habit outlives the migration.
