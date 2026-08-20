# api — Public API surface and barrel conventions

The per-file half. Each rule below reads one file's import specifiers and asks how deep the import
reaches. The half that has to *trace* a barrel — following its re-exports to see what it drags in —
is in [../../structural/api/overview.md](../../structural/api/overview.md).

| Rule | Blocking | What it prevents |
|---|---|---|
| [domain-public-api](domain-public-api.ts) | Yes | External code importing domain internals (deep imports past barrel) |
| [feature-public-api](feature-public-api.ts) | Yes | External code importing feature internals (deep imports past barrel) |
| [barrel-direction](barrel-direction.ts) | Yes | `index.ts` importing from `index.server.ts` (must never reverse) |
| [server-import-context](server-import-context.ts) | Yes | Non-server contexts importing `*/index.server` barrels |

Adoption mechanics, the spec contract, and cross-tag rule selection: [../../overview.md](../../overview.md).
