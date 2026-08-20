# naming/test-file-mirror

| Field | Value |
|---|---|
| **Tag** | naming |
| **Mechanism** | Structural script (cross-file, pre-commit + CI) |
| **Blocking** | No (warn) |

Implementation: [test-file-mirror.ts](test-file-mirror.ts). Knobs live under `checks["naming/test-file-mirror"]` in [../config.ts](../config.ts).

## What it prevents

Test files whose names do not map to the source they cover — `billing.spec.ts` next to `invoices.ts`, or `test_email.ts` covering `mailer.ts`.

When a test mirrors its source (`invoices.ts` → `invoices.test.ts`), one search for the concept surfaces both, and an agent about to change `invoices.ts` immediately sees the test that constrains it. When the names diverge, the test is invisible to that search: the agent edits the source, never finds the test, and either breaks it silently or fails to update it. The cost lands on the *next* reader, which is why nothing in the local edit signals it.

One convention: every test file is named `<source>.test.ts(x)` and sits beside a real source file of that base name.

## Where it applies

Co-located test files under the source root — this architecture places tests beside the code they cover. It is the one check whose subject is a file every other check skips, so it walks with `includeExcluded` while everything else in the tier honours the global test exclusions.

It checks the **test** side of the pairing, in two directions:

- A file carrying a blessed suffix whose sibling source is missing.
- A file carrying an off-convention name, steered toward the canonical suffix.

## What it deliberately does not check

**It never asks whether a source file has a test.** Tests must earn their place and many files correctly have none; a rule that demanded coverage here would manufacture assertion-free test files to satisfy it. The rule is about naming the tests that *exist* so they are discoverable — not about how many there are.

**Nesting suffixes are the trap.** `.integration.test.ts` also ends with `.test.ts`. An implementation that strips the first or shortest matching suffix derives a base of `foo.integration` for `foo.integration.test.ts`, finds no such file, and reports an orphan against a correctly mirrored test — a false positive on the very convention the check is teaching. Strip the **longest** match.

**A sibling may be `.tsx`.** Looking only for `<base>.ts` reports every component test in the project as an orphan at once. Neither of these misfires is visible to a positive fixture; both are caught only by a legal neighbour.

## Adapt

- `testSuffixes` — the blessed suffixes. **Pick ONE convention (`.test.` or `.spec.`) and enforce it.** A project that standardises on `.spec.` swaps the lists rather than adding to them; two live conventions mean two searches for the same thing, which is the failure this rule exists to prevent.
- `nonconforming` — regexes for the off-convention spellings, tested against the source-root-relative path so a prefix pattern like `test_*` can anchor on a path segment. Add whatever the project is migrating away from; an entry here is a rename instruction, not a ban.
- `orphanAllowedDirs` — source-root-relative directory prefixes where a test with no sibling source is legitimate. Cross-cutting suites that map to no single module go here. Keep it short: it is the exemption that quietly turns the check off if it grows to cover a whole feature.

## Example output

```
WARN [test-file-mirror] src/features/billing/service/invoices.spec.ts
  Off-convention test name — this project's suffixes are .test.ts, .test.tsx,
  .integration.test.ts, .integration.test.tsx.
  Spelled this way the test does not surface in a search for the module it
  covers. Rename it to that module's name plus the suffix, so the code and the
  test that constrains it are one search apart.

WARN [test-file-mirror] src/features/billing/service/edge-cases.test.ts
  No edge-cases.ts or edge-cases.tsx sits beside this test, so a search for the
  code it covers never turns it up. Rename the test after the module it
  exercises. If it is a cross-cutting suite that maps to no single module, add
  its directory to orphanAllowedDirs in the project's architecture config.
```

## Why warn, not block

Naming drift in tests costs discoverability, not correctness — the tests still run, and blocking a commit over a filename buys nothing the next commit could not fix. It would also snag legitimate cross-cutting suites: `orphanAllowedDirs` handles the ones a project can name in advance, but the boundary is genuinely fuzzy and a hard stop on a fuzzy boundary gets worked around. A warning steers new tests toward the mirror convention while the naming decision is still cheap. A project whose test layout is fully co-located and disciplined can promote it.

## Fixtures

One orphan test, and both off-convention spellings — the `.spec.` file placed deliberately **beside its own source**, so the orphan branch has nothing to say about it and only a name matcher can see it. Three legal neighbours, one per over-match: an ordinary mirrored pair, a test whose source is `.tsx`, and an `.integration.test.ts` beside its source.
