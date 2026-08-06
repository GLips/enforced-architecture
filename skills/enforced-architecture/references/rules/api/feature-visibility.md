# api/feature-visibility

| Field | Value |
|---|---|
| **Tag** | api |
| **Mechanism** | Structural script (cross-file, pre-commit + CI) — ships as code: [feature-visibility.ts](feature-visibility.ts) |
| **Blocking** | Mixed (ungranted edges block, stale grants warn) |

## What it is

A qualified export, JPMS `exports … to` style, at the feature boundary: feature B names each feature allowed to import it, in `src/features/B/visibility.json`, with a written justification per grant. Everything else denies. `api/feature-public-api` already says *import through the barrel* — this says *and only if the owner let you in*.

The mechanism is the point, and it is smaller than it looks: **the friction sits on the importee's side, in a file, in the diff.** A central allowlist or a tag-based rule enforces the same edges and buys none of this, because an edit to a config the author already had open reads as part of the work. Making feature A's new dependency require an edit to feature B — a file the author had no reason to touch, whose one purpose is recording that B accepts a consumer — is what turns silent accretion into a decision someone has to write a sentence about. Assume the sentence is the deliverable; the JSON is bookkeeping.

## When to take it

Two or more features, and agents writing most of the code. That second condition is what makes it worth the ceremony. A human adding a cross-feature import has usually thought about it; a fleet of agents each solving their own task will each find the shortest legal path to the symbol they need, and the graph is a web before anyone reviews a diff that shows it. If features are few and stable and a person reads every import, `graph/feature-deps` thresholds alone are the cheaper instrument.

Not a substitute for extraction. The grant is the *expensive* answer — reaching for `domains/` or `shared/` is usually the right one, which is why the failure message offers it. A visibility file filling up is the same signal as a rising edge count.

## It is not cycle detection

These get conflated, and the conflation costs real time. Visibility asks *is this one edge intended?* — `graph/feature-deps` asks *what shape does the set of allowed edges form?* The second runs after the first and is blind to it, so **a cycle built from fully-granted, individually-legal edges is still a cycle and still hard-fails.** No configuration buys it back; declaring both directions only makes the cycle explicit.

That distinction is the reading rule when a check fails: *ungranted edge* means declare it or extract; *cycle* means restructure, and editing a visibility file is wasted motion. When neither feature can give up the shared code without cycling, the split is on the wrong axis — re-cut by use-case journey rather than by data ownership.

## Fixtures

The adversarial case decides this rule: **an ungranted edge written relatively** (`../../beta/service` from inside another feature). A check that pattern-matches `@/features/<name>` passes it silently, which is why this one reads the resolved graph — see [graph/import-graph.md](../graph/import-graph.md). Then: a granted edge through `index.server` rather than the client barrel (the grant covers the feature, not the barrel), a type-only cross-feature import (coupling, so it needs a grant), and a malformed `visibility.json` proving it reports *itself* rather than a wall of derived deny-all violations.
