# structure/topology

| Field | Value |
|---|---|
| **Tag** | structure |
| **Mechanism** | Structural script (filesystem, pre-commit + CI) |
| **Blocking** | Yes |

## What it prevents

A file living somewhere no rule looks.

Every other rule in this catalog keys on a filename pattern — `.*/src/domains/.*`, `.*/src/features/[^/]+/(?:repo|service|controllers|ui)/.*`. A path matching none of them is governed by **nothing**. Verified against a fully-configured rule set, this file draws zero diagnostics:

```ts
// src/features/scanner/helpers.ts  — a file at the feature root
import { openDatabaseSync } from "expo-sqlite";
```

It sits inside a feature but outside every layer directory, so `layer-direction` and `layer-occupancy` never see it. It needs no cleverness to write — it is what someone produces when they need a place to put something and the structure does not say.

Nothing stops `src/lib/`, `src/utils/`, or `src/features/scanner/helpers/` from being created either, and each is a new address where none of this applies. Enforcement built entirely on path patterns has to close the set of paths, or it is enforcement on the paths that happened to be there when it was written.

**This rule closes the path grammar and nothing else.** Import policies remain in their dedicated rules.

## Where it applies

The whole source tree. This is the one check whose subject is the *absence* of a match.

## Algorithm

A whitelist, since the failure is the unlisted case.

1. **Enumerate every source file** under the source root.
2. **Allowed root files** — a file sitting directly in the source root must be named in `ALLOWED_ROOT_FILES`. Entrypoints and the env modules live here and are not layers; a whitelist of directory names alone rejects them.
3. **Allowed roots** — for a file inside a directory, the first path segment must be one of the configured layers. Anything else fails, and the message names the layer it probably belongs in.
4. **Allowed feature directories** — inside `features/<name>/`, the first segment must be a configured layer name, or the file must be one of `FEATURE_ROOT_FILES`. A file at a feature root that is not on that list fails.

## Configuration

```typescript
const ALLOWED_ROOTS = ["routes", "features", "domains", "infrastructure", "shared"];
const ALLOWED_FEATURE_DIRS = ["ui", "controllers", "service", "repo"];

// Files directly in the source root. Not layers, and rejected by a
// directory-only whitelist — which is the first thing this rule gets wrong.
const ALLOWED_ROOT_FILES = ["env.ts", "env.server.ts", "env.client.ts", "router.tsx", "client.tsx", "server.ts"];

// The feature's public surface, plus its error types if the architecture
// puts them at the feature root — see directory-model.md.
const FEATURE_ROOT_FILES = ["index.ts", "index.server.ts", "errors.ts"];
```

**Adjustments:** `ALLOWED_ROOTS` mirrors the target directory structure exactly — if the architecture proposal names a layer, it goes here, and if it does not, adding one is a decision rather than a file move. `ALLOWED_ROOT_FILES` and `FEATURE_ROOT_FILES` must be reconciled against the directory model the project actually chose; a file the architecture recommends and this rule rejects is the failure that gets the whole check disabled.

Framework-generated files (a generated route tree, a build manifest) go in the global exclusions, not in `ALLOWED_ROOTS`.

## Message shape

Word these as **directions, not refusals**. This rule fires when someone had nowhere obvious to put something, so the useful response is a destination:

```
FAIL [topology] src/lib/format-date.ts
  src/lib is not a layer. A generic utility with no domain knowledge goes in
  src/shared; logic that encodes a business rule goes in src/domains. If it is
  neither, it probably belongs inside the one feature that uses it.

FAIL [topology] src/features/scanner/helpers.ts
  A file at a feature root is outside every layer, so no layer rule governs it.
  Feature roots hold the barrel and errors.ts. Move this into ui/, controllers/,
  service/ or repo/ — whichever layer's job it is doing.
```

## Fixtures

The feature-root file from *What it prevents*, plus a new top-level directory (`src/lib/`).

Two legal neighbours, both of which a directory-only whitelist wrongly rejects: `src/env.server.ts`, and a feature's `errors.ts` beside its barrel. This rule's failure mode is over-matching on architecture the project's own documentation recommends, so the legal cases carry more weight here than the violations.
