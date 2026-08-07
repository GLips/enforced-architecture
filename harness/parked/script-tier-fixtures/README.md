# Parked: script-tier fixtures

Not wired into anything. Lifted out of `tk` (`architecture-fixtures/` at its repo
root) so they survive while the catalog moves from Biome/GritQL to oxlint, and so
the next person deciding how the script tier gets tested has the prior art rather
than a memory of it.

## What tier this is

Most rules in this catalog are per-file: hand them one file's AST and they can
answer. A few questions can't be answered that way, and in `tk` those became
TypeScript scripts instead of rules. Two things put a check here:

- **Counting across a file set** — file size, hooks per component, props per
  component, components per file. There is no per-file aggregation to hang it on.
- **Resolution across the tree** — whether `../../inbox/ui/x` leaves the current
  feature depends on how deep the importing file sits, so the specifier has to be
  resolved and compared, not matched.

Two more are here because the linter can't see the file at all (`.css`), and one
because it *imports the token source* (`theme.ts`) so the enforced value set and
the scale can't drift apart.

The eight: `prop-count`, `hook-count`, `file-size`, `single-component-export`,
`cross-boundary-alias`, `css-tokens`, `shadow-source`, `token-equality`.

## Why the fixtures exist at all

The tier's failure mode is silent. A check that stops matching does not error — it
reports nothing, and a clean run is indistinguishable from a working one. Reading
the check does not catch it either: the reader shares the author's blind spot.

`prop-count` is the worked example. It matched its parameter list as `\(([^)]*)\)`,
needing the whole signature on one line, so it saw 32 of that repo's 121 components
— precisely the small ones, the only ones that could never breach an 8-prop
threshold. It was green the entire time.

So every case here is **adversarial**: the violation written the way the previous
matcher missed it. Each carries a **legal neighbour** too, because over-matching is
invisible to positive fixtures and is the defect that actually costs — a check that
warns about a four-prop component is one people learn to scroll past.

## Layout, and why it is a tree at all

The per-file rule tier has no tree any more: its specs pass each case's path as a
`filename` field, so `harness/fixtures/<tag>/<rule>/<kind>/` was deleted when the
catalog moved to oxlint. That option is not open here. This is **one shared tree**
that every check runs over at once, with the checks rebased onto it via an
`ARCH_SOURCE_ROOT` env var and the expectations declared centrally in
`check-fixtures.ts`.

That shape follows from the tier: these checks scan declared roots rather than
being handed a file, and several of them scan *more than one* root. Splitting the
tree per check would mean a tree per root per check.

The tree is a synthetic repo — it carries its own `apps/web/src` **and**
`packages/core/src`, because `file-size` scans both and the second root went
unexercised for months while looking fine.

`check-fixtures.ts` is parked alongside because its `EXPECTATIONS` table **is** the
contract. Without it these 38 files are unreadable. Read it first.

Two things it does that are worth keeping in whatever replaces it:

- Findings are compared as a **multiset**, with severity. Comparing bare paths as a
  set silently accepted three separate regressions: a four-matcher check passing
  with three matchers deleted, a hard error demoted to a warning, and five findings
  where one was expected.
- Every declared check must have emitted a `RAN` line. Without that, deleting a
  check, renaming it, stubbing it, or pointing it at a missing root all leave its
  expectations passing on zero findings — the suite reports clean while the check
  is simply gone.

## What is NOT here

Three `file-size` fixtures, because their entire content is their length:

| path | lines | must |
|---|---|---|
| `apps/web/src/features/alpha/lib/oversized.ts` | 616 | BLOCK (over the 600 limit) |
| `apps/web/src/features/alpha/lib/large-neighbour.ts` | 525 | WARN only (500–600) |
| `packages/core/src/oversized-core.ts` | 612 | BLOCK, in the second root |

`check-fixtures.ts` generates them before the run and removes them after. Storing
them cost ~1,750 lines of `export const bulkAlpha1 = 1;` that nobody reads. Both
thresholds need a fixture: one file past both leaves the warn branch unproven.

## What reviving this needs

The scripts themselves are not here, and they are not templates — they are `tk`'s
**adapted instantiations**. `check-file-size.ts` hardcodes 500/600,
`check-token-equality.ts` imports `../../src/shared/ui/theme.ts`, and every root is
spelled `apps/web/src`. So this is not a lift-and-drop into the rule harness:
something has to decide whether the catalog ships these as templates (and what the
adaptable seams are), or documents the tier and leaves consuming projects to write
their own — which is what `references/enforcement-implementation.md` currently says
about adapted rules.

Until that is decided, this is a parking spot. It is not run by `bun run check:rules`
and deliberately so.
