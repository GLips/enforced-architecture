# enforced-architecture

A catalog of architectural lint rules, shipped as templates a project copies in.

## The posture

**These rules are meant to be adopted together, and architected around.** The catalog is
not a menu. An adopting project's default is to pull the whole thing in and shape its tree
to fit, not to browse for the rules that happen to match what it already does.

That is a claim about value: every rule here earns its place, or it should be deleted
rather than left available. "Take what's useful" is how a catalog of dozens of rules becomes a
catalog of five in practice, silently, with nobody deciding.

## Adapt the vocabulary, not the invariant

A project may change **what things are called and how big they may get**. It may not
change **which invariants apply to it**.

- Renaming `features/` to `stuff/`, adding a fifth layer, moving the source root — yes.
  One place to change it.
- A threshold is adaptation: the number is yours. The **existence** of the limit is not —
  you do not get to turn file-size checking off.
- Same shape for layers: rename or add one freely; you do not get to decide layer
  direction doesn't apply to you.

This line is what keeps "configurable where it makes sense" from quietly becoming a menu
again.

## Where a rule applies is vocabulary too

We believe every rule belongs in every project. **Where** each rule applies is
repo-specific: a project points each rule at the tree that owns its subject. A monorepo
saying "the layered app is `apps/web/src`; the db lives in `packages/core`" is naming
things, in exactly the same sense as renaming a layer.

What stays off the table is disabling a rule **inside** the tree that owns its subject.
`db-isolation` scoped to the package that owns the db is correct adoption; `db-isolation`
turned off in the app tree because it is noisy is the menu. The knob is "where does X
live," never "does X apply."

A tree you did not declare is a tree you did not adopt for. Rules are silent outside every
declared tree, and that silence is not coverage — setup docs must say so, or an undeclared
package reads as a clean one.

## One invariant, one owner

Each architectural invariant is enforced in exactly **one** place. Two rules holding
overlapping copies of one policy is the defect this catalog most reliably produces, and
the copies always drift: five import rules once disagreed about whether `shared/ui` could
reach `shared/theme`, because to one of them the file *was* shared and to another the
target was not a feature. Nobody owned the edge.

When two rules can both speak to an edge, that is fine only if they say **different**
things and are **jointly actionable** — following one's advice must not violate the other.
An ownership message that names its owners is compatible with a purity message that names
its directions. An ownership message that prescribes an import the table denies is an edit
loop.

## What the posture means for writing a rule

These follow from "default on, adapt the vocabulary" and are not stylistic:

1. **Knobs are names and numbers, never predicates.** A rule that takes a regex or a glob
   as configuration hands the adopter an off-switch in a costume. Config is enumerable
   vocabulary — directory names, layer names, thresholds, explicit rows. Not patterns.

2. **Exemptions are structural facts, not curated lists.** "A `.test.ts` is a test" is a
   fact about the file. A filename list a project extends is a bypass vector. If an
   exemption can be grown by the adopter, it is a menu re-entering through the back door.

3. **Registration and enablement are one list.** A rule present in `plugin.ts` but absent
   from the shipped `oxlintrc.json` is a defect, not an oversight — it means an adopting
   project loads the rule and never runs it.

4. **Negative space is obligatory.** If a rule cannot be switched off, its blind spots
   cannot be opted out of either. Every case a rule deliberately does not cover is stated
   in its header, or adopters will assume coverage they do not have.

## Proving a rule works

A check that silently stops matching reports nothing, and a clean run is indistinguishable
from a working one. This is the failure mode the catalog exists to prevent and the one it
keeps committing.

**Every guard is revert-probed.** Delete the guard, confirm the matching fixture actually
fails. A fixture that passes both before and after a change pins nothing. This is not
optional diligence — across four tickets, five separate guards were found that could be
deleted with `bun run check` fully green. Every one was caught by a fresh reader; none by
the suite.

Where a rule's *wording* carries meaning the verdict does not — a type-aware variant, a
malformed-input message — assert the message, not just the path and severity. The `absent`
half of a message assertion is the load-bearing one: it is the only way to state that a
branch is narrow.

## Reviewing

Non-trivial work gets a fresh-context review before it closes. On this catalog that has
never once been ceremony.
