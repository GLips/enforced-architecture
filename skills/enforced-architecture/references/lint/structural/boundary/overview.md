# boundary — Layer direction and import restrictions

The whole-tree half. Both checks consume the resolved import graph rather than matching specifier
text, which is what lets them see an edge no spelling can hide. The per-file rules are in
[../../oxlint/boundary/overview.md](../../oxlint/boundary/overview.md).

`cross-boundary-alias` is the one to take first. Every path-matching rule in the oxlint half is
bypassed by a relative import reaching the same module, and this is the check that closes it.

| Rule | Blocking | What it prevents |
|---|---|---|
| [cross-boundary-alias](cross-boundary-alias.md) | Yes | Relative imports that cross a boundary — a bypass for every rule that matches the aliased path. Consumes the import graph |
| [layer-occupancy](layer-occupancy.md) | Yes | Bypassing present layers (e.g., controllers importing schema when repo/ exists, or importing repo when service/ exists) |

Adoption mechanics, the spec contract, and cross-tag rule selection: [../../overview.md](../../overview.md).
