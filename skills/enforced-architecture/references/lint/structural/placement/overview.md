# placement — Where code may live

`placement/` is about the address a file has; [`boundary/`](../boundary/overview.md) is about what
it may import from there.

The whole-tree half. `topology` is the completeness check: every other rule in the catalog governs
paths it recognises, this one governs the paths nothing recognises. `layer-direction` reads the
resolved graph, so it sees an upward edge at any nesting depth and in either spelling. The per-file
half is in [../../oxlint/placement/overview.md](../../oxlint/placement/overview.md).

| Rule | Blocking | What it prevents |
|---|---|---|
| [topology](topology.md) | Yes | Files living where no rule looks — unlisted `src/` roots, modules at a feature root, routes reaching into infrastructure |
| [layer-direction](layer-direction.md) | Yes | Within-feature layer direction violations (e.g., repo importing controllers), at any nesting depth and in either spelling. Consumes the import graph |

Adoption mechanics, the spec contract, and cross-tag rule selection: [../../overview.md](../../overview.md).
