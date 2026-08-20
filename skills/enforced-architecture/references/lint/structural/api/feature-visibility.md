# api/feature-visibility

| Field | Value |
|---|---|
| **Tag** | api |
| **Mechanism** | Structural check — [feature-visibility.ts](feature-visibility.ts) |
| **Blocking** | Mixed (ungranted edges fail, stale grants warn) |

## What it is

A qualified export, JPMS `exports … to` style, at the feature boundary: feature B names each feature allowed to import it, in `src/features/B/visibility.json`, with a written justification per grant. Everything else denies. `boundary/import-policy` already says *import through the barrel* — this says *and only if the owner let you in*.

The mechanism is the point, and it is smaller than it looks: **the friction sits on the importee's side, in a file, in the diff.** A central allowlist or a tag-based rule enforces the same edges and buys none of this, because an edit to a config the author already had open reads as part of the work. Making feature A's new dependency require an edit to feature B — a file the author had no reason to touch, whose one purpose is recording that B accepts a consumer — is what turns silent accretion into a decision someone has to write a sentence about. Assume the sentence is the deliverable; the JSON is bookkeeping.

## When to take it

Two or more features, and agents writing most of the code. That second condition is what makes it worth the ceremony. A human adding a cross-feature import has usually thought about it; a fleet of agents each solving their own task will each find the shortest legal path to the symbol they need, and the graph is a web before anyone reviews a diff that shows it. If features are few and stable and a person reads every import, [graph/feature-deps](../graph/feature-deps.md) thresholds alone are the cheaper instrument.

Not a substitute for extraction. The grant is the *expensive* answer — reaching for `domains/` or `shared/` is usually the right one, which is why the failure message offers it. A visibility file filling up is the same signal as a rising edge count.

## It is not cycle detection

These get conflated, and the conflation costs real time. Visibility asks *is this one edge intended?* — `graph/feature-deps` asks *what shape does the set of allowed edges form?* The second runs after the first and is blind to it, so **a cycle built from fully-granted, individually-legal edges is still a cycle and still hard-fails.** No configuration buys it back; declaring both directions only makes the cycle explicit.

That distinction is the reading rule when a check fails: *ungranted edge* means declare it or extract; *cycle* means restructure, and editing a visibility file is wasted motion. When neither feature can give up the shared code without cycling, the split is on the wrong axis — re-cut by use-case journey rather than by data ownership.

## Where it applies

Every cross-feature edge in the resolved import graph, and every feature's grant file — including features nothing imports, so a grant that has outlived its import still gets audited.

A feature here is a **directory** under `features/`, occupied or not. That is wider than the rest of the tier, which walks directories holding source, and it is the point: a leftover directory whose code is gone but whose `visibility.json` is not is where a grant outlives its whole feature.

**A feature is identified by the directory it resolves to, not by how a specifier spelled it.** An importee named through a symlink beside its target, or in a different casing on a case-insensitive filesystem, is the same feature — one grant, in the real directory's file, and findings addressed there. The collapsing happens where the edge set is built, not at lookup: get that backwards and a grant written in the real file clears the error while reading as stale under the other name, so the author is told to delete what they just wrote.

## Adapt

The only knob is `config.checks["api/feature-visibility"].visibilityFilename`. Which directory holds features is `config.source.featuresDirName`.

The file's shape is a flat JSON object mapping importing feature name to justification:

```json
{
  "billing": "Reads the seat count to price a subscription. Owned by us; billing does not write here."
}
```

## Negative space

- **Feature ends come from the classification, never from the specifier text.** `../../beta/service` is the same edge as `@/features/beta` and needs the same grant. A check that pattern-matches `@/features/<name>` passes the relative spelling silently, which is the adversarial case that decides this rule.
- **Type-only imports count.** A type crossing a feature boundary still couples the two — the importee cannot reshape it without breaking the importer — so erasure at runtime buys no exemption.
- **The grant covers the feature, not the barrel.** An import through `index.server` needs the same entry as one through the client barrel.
- **An empty justification is rejected, and the whole file with it.** A grant nobody had to think about is the exact thing this rule exists to prevent, so the file fails rather than the entry being honoured.
- **A malformed file reports itself and nothing else.** Deriving deny-all violations from an unparseable file would bury the one real error under every edge into the feature.
- **Only the importee end is resolved.** The importing end comes from walking the tree, so it is already the name on disk. A symlinked *file* inside feature A pointing into feature B's internals is not caught: it resolves as an edge within A, and no cross-feature edge is ever built for the graph to audit. Import resolution is textual — this rule audits edges, and cannot see a boundary crossing the graph did not record as one.
- **A loose file at the features root is not a feature, and is the one importee this rule stays silent about.** `features/orphan-module.ts` classifies as a feature named `orphan-module.ts`; denying an import of it would file against `features/orphan-module.ts/visibility.json`, a path nobody can create and a finding nobody can clear. `placement/topology` reports the loose file itself, which is the half that can be acted on.
- **No feature-to-feature grant is inherited or transitive.** A grants B and B grants C says nothing about A importing C.
- **A stale grant is reported at pre-commit only when the commit wrote it.** The orchestrator suppresses warnings for files a commit did not stage, and every finding here is filed against the importee's `visibility.json`. So the question is not which of the two warnings fired, it is where the change that invalidated the grant landed. Write a bad grant — a typo, or an entry added a commit ahead of its import — and you staged that file, so you see it in the hook. Invalidate a good one from a distance — the importer drops its last import, or the granted feature is renamed or deleted elsewhere — and nothing stages the importee's file, so the warning waits for an unfiltered run. Both messages reach both fates. The case this warning exists for, coupling that can return with no diff, is by construction the second kind, so run the tier in CI as well as pre-commit or you do not cover it. Errors are never filtered, which is separately what makes filing a blocking finding against a file the offending commit never touched work at all.

## Example output

```
FAIL [api/feature-visibility] src/features/auth/visibility.json
  billing imports auth, which has not granted it.
    src/features/billing/service/subscriptions.ts
    src/features/billing/ui/plan-selector.tsx
  Add "billing" with a justification for why auth accepts this consumer — the
  grant is the importee's to make. Or lift the shared code to domains/ or
  shared/: neither carries a visibility edge, so both features reach it without
  coupling to each other. Extraction is usually the right answer; the grant is
  the expensive one.

WARN [api/feature-visibility] src/features/auth/visibility.json
  Grants "reporting", which imports nothing from auth. Drop the entry — a grant
  outliving its import lets the coupling return with no diff, which is the one
  moment this rule exists to make visible.
```
