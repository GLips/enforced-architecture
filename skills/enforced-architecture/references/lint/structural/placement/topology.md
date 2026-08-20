# placement/topology

| Field | Value |
|---|---|
| **Tag** | structure |
| **Mechanism** | Structural script (filesystem walk, pre-commit + CI) |
| **Blocking** | Yes |

Implementation: [topology.ts](topology.ts).

## What it prevents

A file living somewhere no rule looks.

Every other rule in this catalog keys on a path pattern — `.*/src/domains/.*`, `.*/src/features/[^/]+/(?:repo|service|controllers|ui)/.*`. A path matching none of them is governed by **nothing**. Verified against a fully-configured rule set, this file draws zero diagnostics:

```ts
// src/features/scanner/helpers.ts  — a file at the feature root
import { openDatabaseSync } from "expo-sqlite";
```

It sits inside a feature but outside every layer directory, so `layer-direction` and `layer-occupancy` never see it. It needs no cleverness to write — it is what someone produces when they need a place to put something and the structure does not say.

Nothing stops `src/lib/`, `src/utils/`, or `src/features/scanner/helpers/` from being created either, and each is a new address where none of this applies. Enforcement built entirely on path patterns has to close the set of paths, or it is enforcement on the paths that happened to be there when it was written.

A whitelist, therefore, since the failure is the unlisted case: a blacklist can only name the bad addresses somebody already thought of, which is the same bet that produced the gap.

## Where it applies

The whole source tree, `**/*.{ts,tsx}` under the source root. This is the one check whose subject is the *absence* of a match, so scoping it to a subtree would reintroduce exactly the hole it closes — the ungoverned path would simply be one the check does not walk.

Stylesheets are out of scope. A `.css` file is not a module and cannot import one; where it may live is `style/css-tokens`' business, not the path grammar's.

## Negative space

**This rule closes the path grammar and nothing else.** It says a file is at a legal address, never that its imports are legal from there. `placement/layer-direction`, `boundary/layer-occupancy` and the `boundary/` tag keep their subjects — this rule's contribution is that those rules now reach every file, because there is nowhere left to write one that they do not match.

**It does not care what is inside the file.** A file at a legal address holding the wrong kind of code is a layer question, and answering it here would mean this rule and the layer rules disagreeing about the same file.

## Why the grammar is per-boundary

`features/` and `domains/` are both subdivided directories and they are **not** the same shape. A feature's layers are load-bearing: every feature-scoped rule keys on `features/<name>/<layer>/`, so a directory inside a feature that is not a layer is reached by nothing — which is the gap this rule exists to close. Domain-scoped rules key on `domains/<name>/` and reach the whole subtree, so a parser sitting at a domain root is already fully governed and there is nothing for a path to escape into.

That is why `boundaries` is keyed by directory name rather than being one feature-shaped grammar applied to both. Applying the feature grammar to domains rejects `domains/<name>/<internal-module>.ts` — the exact layout [directory-model.md](../../../directory-model.md) recommends, "internal modules (parsers, transforms, etc.)" at the domain root. Two people implementing against this catalog independently hit that rejection and both moved their files to appease it. In a real project that move is spelled differently: the check gets switched off.

The general form of the mistake is worth naming, because it will recur when a project adds a third subdivided directory: **a whitelist copied from the directory it was written for governs the next directory by accident.** Give each one its own grammar, or the strictest one wins everywhere.

## Adapt

Three knobs, under `checks["placement/topology"]`, plus `source.subdividedDirs` which it shares with every other structural check:

- **`allowedRoots`** — the closed set of first path segments. It mirrors the target directory structure exactly: if the architecture proposal names a layer it goes here, and if it does not, adding one is a decision rather than a file move.
- **`allowedRootFiles`** — files sitting directly in the source root. Entrypoints and env modules are not layers, and a directory-only whitelist rejects them, which is the first thing this rule gets wrong.
- **`boundaries`** — the path grammar inside each subdivided directory, keyed by directory name. `{ kind: "layered", rootFiles, layers }` closes both the boundary root and the layer set; `{ kind: "unlayered" }` says the boundary is governed whole and stops there. Every entry of `source.subdividedDirs` needs one, and a missing entry is reported against the config rather than passing silently — a whitelist with a hole in it reports clean over exactly the paths it cannot describe.

`source.subdividedDirs` decides which top-level directories have boundaries one level down rather than being one themselves. A source root that subdivides `packages/` or `modules/` names those instead, and each gets its own entry in `boundaries`.

**Reconcile `allowedRootFiles` and each boundary's `rootFiles` against the directory model the project actually chose** — see [directory-model.md](../../../directory-model.md). A file the architecture recommends and this rule rejects is the failure that gets the whole check disabled rather than fixed, and it is disabled by whoever hits it on their first commit.

Framework-generated files (a generated route tree, a build manifest) go in the global exclusions, **not** in `allowedRoots`. Widening the whitelist to admit generated output opens that address to hand-written code too, permanently and silently.

## Message shape

Word these as **directions, not refusals**. This rule fires when someone had nowhere obvious to put something, so the useful response is a destination:

```
FAIL [topology] src/lib/format-date.ts
  src/lib is not a layer. A generic utility with no domain knowledge goes in
  src/shared; logic that encodes a business rule goes in src/domains. If it is
  neither, it probably belongs inside the one feature that uses it.

FAIL [topology] src/features/scanner/helpers.ts
  A file at a features root is outside every layer, so no layer rule governs it.
  features/scanner/ holds index.ts, index.server.ts, errors.ts and nothing else.
  Move this into ui/, controllers/, service/, repo/ — whichever layer's job it is
  doing. If every features boundary needs a file by this name, it goes in the
  `rootFiles` of that boundary's grammar.
```

Every destination in those two is read from the config rather than written into the message, so a project that renames a layer gets correct directions without editing prose. The one message that cannot be a pure destination — a genuinely new layer — names the config key instead, because the resolution there is a decision someone has to make rather than a file to move.

## Fixtures

The feature-root file from *What it prevents* is an adversarial case, not the obvious one: it sits **inside** a governed directory, so a whitelist checking only the first path segment sees `features`, passes it, and misses the file its own doc names. The obvious case is a new top-level directory, `src/lib/`.

The second adversarial case is a file directly in the subdivided directory, `src/features/orphan-module.ts`. It belongs to no boundary at all, and an implementation that starts matching at `features/<name>/<layer>` binds `orphan-module.ts` to `<name>`, finds no layer under it, and then either reports the wrong thing or nothing. It is the easiest position in the grammar to leave out, because nobody pictures the file that has no boundary.

Four legal neighbours, all of which some plausible implementation wrongly rejects: `src/env.server.ts`; a feature's `errors.ts` beside its `index.ts` barrel; and `src/domains/ledger/posting-rules.ts`, the internal module at a domain root. This rule's failure mode is over-matching on architecture the project's own documentation recommends, so the legal cases carry more weight here than the violations — dropping the file whitelist makes the check reject the barrel every consumer of a feature is required to import through, and giving domains the feature grammar makes it reject the domain layout wholesale.
