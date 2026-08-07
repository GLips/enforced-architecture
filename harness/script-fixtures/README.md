# The structural-script fixture tree

One synthetic repo, under `tree/`, that every structural-script check runs over
at once. `bun run check:scripts` points the checks at it through `config.ts` and
compares what they report against the expectations in `expectations/`.

## Why a tree at all, when the rule tier gave its up

The per-file rule tier has no fixture tree any more: `RuleTester` takes each
case's path as a `filename` field, so `harness/fixtures/<tag>/<rule>/<kind>/`
became one line in a spec and the directory went.

That option is not open here. These checks **scan declared roots** rather than
being handed a file, several of them scan *more than one* root, and two of them
read surfaces that are not JavaScript at all (`.css`, `visibility.json`). A
600-line file's length is its entire content. So the cases have to be real files,
and one shared tree is the only shape that does not mean a tree per root per
check.

The tree is a synthetic repo. It carries `tree/src` **and**
`tree/packages/core/src`, because `health/file-size` scans both and the second
root went unexercised for months while looking fine — a check pointed at a path
that does not exist returns cleanly by design, so an unexercised root is
indistinguishable from a working one.

## Why the fixtures exist

The tier's failure mode is silent. A check that stops matching does not error —
it reports nothing, and a clean run is indistinguishable from a working one.
Reading the check does not catch it either: the reader shares the author's blind
spot.

`react/prop-count` is the worked example. It matched its parameter list as
`\(([^)]*)\)`, needing the whole signature on one line, so it saw 32 of one
repo's 121 components — precisely the small ones, the only ones that could never
breach an 8-prop threshold. It was green the entire time.

## The three kinds

Every check declares all three in `expectations/<tag>/<name>.ts`, and an empty
list fails the run:

1. **obvious** — the violation the check's own doc names.
2. **adversarial** — the same violation written the way the check's natural
   matcher misses. This is the case that decides whether the check works, and the
   one an author writing their own fixtures will not think of.
3. **legal** — paths of files that look like the violation and are allowed.
   Over-matching is invisible to positive cases, and it is the defect that trains
   people to ignore a check. Naming the files rather than relying on the multiset
   comparison means a *deleted* legal neighbour fails loudly instead of quietly
   reducing coverage.

Findings are compared as a **multiset, with severity**. Both halves had to be:
comparing bare paths as a set silently accepted three separate regressions — a
four-matcher check passing with three matchers deleted, a hard error demoted to a
warning, and five findings where one was expected. Line numbers are deliberately
*not* compared, because pinning them means editing a fixture's comment header
breaks an unrelated expectation, which teaches people to re-baseline without
reading why it moved.

## What the runner checks that a comparison does not

Each of these leaves a green run behind a check nothing exercises:

- **A check missing from `scripts/registry.ts`.** The registry is the manifest a
  consuming project copies; a check absent from it ships as a file nobody loads.
  The runner imports it rather than grepping, so a commented-out registration
  fails.
- **A registered check with no expectations file**, and the reverse — an
  expectations file under no registered check's name.
- **A check with no `rules/<id>.ts` or no `rules/<id>.md`.** The id, the
  implementation, and the doc must be the same three names.
- **A check that threw.** It is reported as a blocking failure rather than as an
  empty result, because "found nothing" and "crashed" produce identical findings.
- **A legal neighbour that is no longer in the tree.**

Every one of these was revert-probed when the runner was built. Do it again after
any change here: break a check and expect its adversarial kind to report MISSED;
demote an error to a warning and expect the severity comparison to catch it;
delete a check from the registry and expect the runner to say so.

## Adding a check

Four files, and the runner fails until all four line up:

```
skills/…/rules/<tag>/<name>.ts        the check, exporting a StructuralCheck
skills/…/rules/<tag>/<name>.md        intent, negative space, adapt notes
skills/…/rules/scripts/registry.ts    one entry
harness/script-fixtures/expectations/<tag>/<name>.ts
```

Plus its fixtures in `tree/`. Two rules keep a shared tree workable:

- **A fixture must be legal for every check but its own.** The tree is a
  conforming repo except where it deliberately is not, so a new file at an
  unlisted path or carrying a relative cross-boundary import trips
  `structure/topology` or `boundary/cross-boundary-alias` on top of whatever it
  was written for.
- **Never edit another check's expectations.** If a fixture makes another check
  fire, move or rename the fixture rather than widening someone else's contract.

Generated fixtures — where the *size* of a file is the whole test — are declared
as numbers in the `generated` field and materialised for the duration of the run.

## The runtime

`check:scripts` runs under Bun, because the checks use `Bun.Glob` and
`Bun.Transpiler`. That is the opposite of `check:rules`, which needs real Node —
oxlint's `RuleTester` refuses Bun by name. The two harnesses do not share a
runtime and are not meant to.
