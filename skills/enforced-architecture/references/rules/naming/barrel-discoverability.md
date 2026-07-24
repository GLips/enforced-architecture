# naming/barrel-discoverability

| Field | Value |
|---|---|
| **Tag** | naming |
| **Mechanism** | Structural script (cross-file, pre-commit + CI) |
| **Blocking** | Yes |

## What it prevents

Public barrels (`index.ts` / `index.server.ts`) that hide or rename the symbols they expose, defeating text search. Two shapes:

1. **Wildcard re-exports** — `export * from "./stripe"`. The barrel advertises no names, so an agent grepping for what a module offers finds nothing at the barrel and must open every re-exported file to discover the surface. It also lets new exports leak through the public API silently, with no review at the boundary.
2. **Renamed re-exports** — `export { createClient as createStripeClient } from "./stripe"`. The public name (`createStripeClient`) and the real definition (`createClient`) now share no text. A reverse lookup on either one finds only half the story: grep the public name and the definition is invisible; grep the definition and the callers are invisible.

Agents treat the barrel as the map of a module. When the map uses `*` or aliases, the territory no longer matches it. This rule keeps every publicly exported name identical to its definition and explicit at the boundary.

## Why a script, not GritQL

Biome's GritQL does not reliably match ES re-export syntax with backtick patterns (see the note in `api/barrel-direction`). Re-exports are exactly what this rule targets, so it runs as a structural script instead. The cost is trivial: barrels are few and short, so the script only reads a handful of small files.

## Where it applies

Public barrel files only — the two-barrel pattern this architecture uses:
- `src/(domains|features)/*/index.ts`
- `src/(domains|features)/*/index.server.ts`

Adjust the glob to your project's barrel locations (e.g., drop `domains` if there is no domains layer, or add `shared/*/index.ts` if shared modules expose barrels).

Does NOT apply to internal (non-barrel) files — renaming and wildcard imports inside a module are the module's own business; only the *public* surface must stay greppable.

## Algorithm

1. **Find barrel files** — glob the public barrel paths above.
2. **Read each barrel** — parse export statements. A regex pass is sufficient and avoids a TS-AST dependency; upgrade to the compiler API only if comment-embedded export text causes false positives in practice.
3. **Flag wildcard re-exports** — any `export * from "..."` or `export * as ns from "..."`. FAIL.
4. **Flag renamed re-exports** — any `export { X as Y } from "..."` where `X !== Y`. FAIL, naming both sides. (A plain `export { X } from "..."` is fine — the name is preserved.)
5. **Ignore type-only nuance** — `export type { X as Y }` is lower risk (types aren't reverse-looked-up the same way) but still worth flagging by default; make it configurable if a project relies on type aliasing at the barrel.

## Configuration

```typescript
// Barrel locations — adapt to your project's public API surface.
const BARREL_GLOBS = [
  "src/{domains,features}/*/index.ts",
  "src/{domains,features}/*/index.server.ts",
];

// Whether to also flag renamed *type* re-exports (export type { X as Y }).
// Types are reverse-looked-up less often, but aliasing still splits search.
const FLAG_TYPE_ALIASES = true;
```

## Example output

```
FAIL: barrel-discoverability — src/features/billing/index.ts:3
  `export * from "./stripe"` hides the names this module exposes.
  List each public symbol explicitly: `export { createStripeClient, StripeWebhook } from "./stripe"`.

FAIL: barrel-discoverability — src/features/billing/index.ts:5
  `export { createClient as createStripeClient }` renames on the way out —
  the public name and the definition `createClient` now share no text, so a
  reverse lookup on either misses the other. Rename the definition to
  `createStripeClient` and re-export it unaliased.
```

## Why blocking

The whole point of the two-barrel public API is that the barrel is the authoritative, greppable index of a module. A wildcard or alias silently breaks that contract, and once one barrel does it the pattern spreads. Blocking at author time is cheap; unwinding aliased public names after callers depend on them is not.
