# api — Public API surface and barrel conventions

| Rule | Mechanism | Blocking | What it prevents |
|---|---|---|---|
| [domain-public-api](domain-public-api.ts) | oxlint | Yes | External code importing domain internals (deep imports past barrel) |
| [feature-public-api](feature-public-api.ts) | oxlint | Yes | External code importing feature internals (deep imports past barrel) |
| [barrel-direction](barrel-direction.ts) | oxlint | Yes | `index.ts` importing from `index.server.ts` (must never reverse) |
| [server-import-context](server-import-context.ts) | oxlint | Yes | Non-server contexts importing `*/index.server` barrels |
| [barrel-purity](barrel-purity.md) | Script | Yes | Client-safe barrels transitively pulling in server-only packages |
| [feature-visibility](feature-visibility.md) | Script | Mixed | Cross-feature imports the importee never granted. Ungranted edges block, stale grants warn. Consumes the import graph |

Adoption mechanics, the spec contract, and cross-tag rule selection: [../overview.md](../overview.md).
