# api — Public API surface and barrel conventions

The per-file half. Each rule below reads one file's import specifiers and asks how deep the import
reaches. The half that has to *trace* a barrel — following its re-exports to see what it drags in —
is in [../../structural/api/overview.md](../../structural/api/overview.md).

How deep an import into a *feature* or a *domain* may reach is not here — both are columns in
[boundary/import-policy](../boundary/import-policy.ts), because the answer depends on which layer is
asking and that is the same question every other cell of the table answers. The domain column reads
`barrel` from the four positions that may reach a domain at all — a feature's `controllers/` and
`service/`, a module at a feature's root, another domain — and `deny` from the other eight, so there
is no single answer a per-file rule could hold.

| Rule | Blocking | What it buys |
|---|---|---|
| [barrel-direction](barrel-direction.ts) | Yes | You add an export to `index.server.ts` with no change to what `index.ts` gives a client component |
| [server-import-context](server-import-context.ts) | Yes | Every caller of a `*/index.server` barrel sits in a server directory or a `*.server.ts` file |

Adoption mechanics, the spec contract, and what part of the tree owns each rule's subject: [../../overview.md](../../overview.md).
