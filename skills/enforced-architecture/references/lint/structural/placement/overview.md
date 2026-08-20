# placement — Where code may live

`placement/` is about the address a file has; [`boundary/`](../boundary/overview.md) is about what
it may import from there.

The whole-tree half. `topology` is the completeness check: every other rule in the catalog governs
paths it recognises, this one governs the paths nothing recognises. `layer-direction` reads the
resolved graph, so it sees an upward edge at any nesting depth and in either spelling. The per-file
half is in [../../oxlint/placement/overview.md](../../oxlint/placement/overview.md).

| Rule | Blocking | What it buys |
|---|---|---|
| [topology](topology.ts) | Yes | Each source file under a declared tree is at a path that a rule in this catalog matches |
| [layer-direction](layer-direction.ts) | Yes | Inside one feature, an import only goes down the layer stack, and no file imports the feature's own barrel |

`topology` says a file is at a permitted path. It never says the imports in that file are permitted.
`layer-direction` and the `boundary/` rules keep those subjects.

Before you take `topology`, compare the tree's `sourceRootFiles` and `featureRootFiles` with the
directory model the project chose. A file that the project's own model recommends, and this rule
rejects, makes a person turn the whole check off on the first commit. Both lists live in the tree
declaration rather than beside this check, because the import policy reads the same names — two
lists meant a file this check permitted and the policy called an unpoliced area.

`layer-direction` does not report a downward import that skips a layer. `boundary/layer-occupancy`
asks that question, from the same layer order — which is the ORDER of the shared layer roles, so the
two cannot disagree about which layer outranks which. `layer-direction` has no exclusion list,
and its severity is not configurable, so a codebase that adopts it must correct the upward edges it
already has. Its coverage is the coverage of `graph/import-graph`: an import form the graph does not
reveal is an edge this rule never receives.

Adoption mechanics, the spec contract, and cross-tag rule selection: [../../overview.md](../../overview.md).
