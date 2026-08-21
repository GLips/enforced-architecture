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

## Who owns which edge

Both rules fence the same specifier, and they split on the file doing the naming, not on the
specifier. A unit's own client barrel — `index.ts` sitting directly in a feature or a domain — is
`barrel-direction`'s alone. Everywhere else in a client context, including a `ui/index.ts` that is a
barrel by name and not a unit's surface, is `server-import-context`'s.

The split is not tidiness. `server-import-context`'s message says to use the client-safe barrel
`index`, and its fastest stated fix is to rename the file `*.server` — on `index.ts` the first is an
instruction the file cannot follow and the second deletes the unit's public surface. So the two
subjects are "what a unit's surface may NAME" and "which contexts may reach PAST it", and
`isUnitClientBarrel` in [../../policy/declared-trees.ts](../../policy/declared-trees.ts) holds the
line so neither end can move it alone. Which specifier spellings name the barrel is
[../lib/server-barrel-specifier.ts](../lib/server-barrel-specifier.ts)', for the same reason.

Adoption mechanics, the spec contract, and what part of the tree owns each rule's subject: [../../overview.md](../../overview.md).
