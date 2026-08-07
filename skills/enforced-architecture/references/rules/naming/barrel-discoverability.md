# naming/barrel-discoverability

| Field | Value |
|---|---|
| **Tag** | naming |
| **Mechanism** | Structural script (pre-commit + CI) |
| **Blocking** | Yes |

Implemented in `naming/barrel-discoverability.ts`. Configured under
`checks["naming/barrel-discoverability"]` in `scripts/config.ts`.

## What it prevents

Public barrels (`index.ts` / `index.server.ts`) that hide or rename the symbols they expose, defeating text search. Two shapes, and they cost a reverse lookup different things:

1. **Wildcard re-exports** — `export * from "./stripe"`, and `export * as stripe from "./stripe"`. The barrel advertises no names at all. An agent grepping for what a module offers finds nothing at the barrel and has to open every re-exported file to learn the surface. The namespace form is not the milder version of this: it hides the same names behind one more. A wildcard also means every future export of `./stripe` joins the public API silently, with no review at the boundary — the barrel stops being a decision and becomes a pipe.
2. **Renamed re-exports** — `export { createClient as createStripeClient } from "./stripe"`. The public name and the definition now share no text. Grep `createStripeClient` and the definition is invisible; grep `createClient` and the callers are. Neither half of the lookup announces that the other half exists, which is what makes this worse than a bad name: a bad name is findable. A plain `export { createStripeClient } from "./stripe"` is fine — the name is preserved, and the barrel is doing exactly its job.

Agents treat the barrel as the map of a module. When the map uses `*` or aliases, the territory no longer matches it.

## Why a script, not a lint rule

Nothing here is structural, and this is the one rule in the tier honest about that. The whole check is decidable from the file in hand: a visitor sees `ExportAllDeclaration` (both `export *` and `export * as ns`) and each `ExportNamedDeclaration` specifier's local/exported pair directly, and `context.filename` is enough to restrict it to barrels. No cross-file resolution, no counting across a set, no surface the linter cannot parse.

It stays a script for two reasons, neither of them principled: barrels are few and short, so globbing them costs nothing, and it rides along with `naming/test-file-mirror`, which does need the filesystem.

Port it to the lint tier if you want the diagnostic in the editor at author time rather than at commit. The intent transfers unchanged and the AST removes the one compromise the script makes — matching export statements as text, which is why it blanks comments before matching so a commented-out `export *` cannot fire.

## Where it applies

Public barrels only, resolved from `barrelGlobs` — source-root-relative, defaulting to the two-barrel pattern this architecture uses:

- `(domains|features)/*/index.ts`
- `(domains|features)/*/index.server.ts`

Does **not** apply to internal files. A wildcard or an alias inside a module is the module's own business — how it forwards names among its own files changes nothing about what the outside world can find. Only the public surface has to stay greppable, and a version of this rule that walked the whole tree would fire on ordinary code within a week of being adopted.

Does **not** care whether the re-export has a `from` clause. `import { createClient } from "./stripe"` followed by `export { createClient as createStripeClient }` splits a reverse lookup exactly as much as the one-line form, and is the obvious way around a rule that only matched the one-liner.

`export { default as Button }` **is** flagged, and deliberately: a default export carries no name to grep for at all, so the barrel is the only place the name exists. Give the definition the name and export it.

## The type-alias nuance

`export type { X as Y }` and the inline `export { type X as Y }` are governed by `flagTypeAliases`, on by default.

Types are reverse-looked-up less often than values — you follow a type through the compiler more than through a grep — so the cost is genuinely lower. It is not zero: the aliased type still has a public name that appears nowhere near its definition. Turn the knob off only if the project has a deliberate convention of aliasing types at the barrel, and know that you are trading away half of those lookups.

## Adapt notes

- `barrelGlobs` names the barrels. Relative to the **source root**, not the project root. Drop `domains/*` if there is no domains layer; add `shared/*/index.ts` if shared modules expose barrels. A glob matching nothing is not an error — it reports cleanly, so a typo here reads exactly like a conforming repo.
- `flagTypeAliases` decides the paragraph above.
- Nothing else. There is no exclusion list: a barrel that needs an exemption is a barrel whose public API is not a decision anyone made.

## Example output

```
FAIL: barrel-discoverability — src/features/billing/index.ts:3
  `export * from "./stripe"` hides the names this module exposes.
  List each public symbol explicitly instead. The barrel is the map an agent
  greps to learn what this module offers, and a wildcard leaves it blank — it
  also lets every future export of "./stripe" join the public API with no
  review at the boundary.

FAIL: barrel-discoverability — src/features/billing/index.ts:5
  `export { createClient as createStripeClient } from "./stripe"` renames on the way out.
  The public name and the definition `createClient` now share no text, so a reverse
  lookup on either misses the other: grep createStripeClient and the definition is
  invisible, grep createClient and the callers are. Rename the definition to
  createStripeClient and re-export it unaliased.
```

## Why blocking

The whole point of the two-barrel public API is that the barrel is the authoritative, greppable index of a module. A wildcard or an alias breaks that contract without breaking anything a test would notice, and once one barrel does it the pattern spreads — the next author reads the neighbour, not the rule. Blocking at author time is cheap: the fix is typing the names out. Unwinding an aliased public name after callers depend on it is not.
