# boundary — Layer direction and import restrictions

The whole-tree half. Both checks consume the resolved import graph rather than matching specifier
text, which is what lets them see an edge no spelling can hide. The per-file rules are in
[../../oxlint/boundary/overview.md](../../oxlint/boundary/overview.md).

`import-policy` is the one to take first, and it is half of a rule rather than a whole one: the
oxlint adapter judges aliased specifiers and bare packages, this one judges resolved relative edges,
and both hand the same string to the same table. Taking one without the other leaves every verdict
true of one spelling only.

| Rule | Blocking | What it buys |
|---|---|---|
| [import-policy](import-policy.ts) | Yes | Every relative import gets the same verdict as its aliased form, and every import that leaves its unit uses the alias |
| [layer-occupancy](layer-occupancy.ts) | Yes | If a feature has a repo directory, every query to its tables is in that directory |

`import-policy` has no exclusion list and no per-directory scope. A codebase that adopts it already
holds imports that this rule denies, so adoption is one correction pass over the whole tree.

`layer-occupancy` does not see a bypass that goes through the feature's own barrel. A file at a
feature root has no layer. The path `ui/` -> `@/features/<self>` -> `service/` thus has no layer at
either end, and the check reports nothing. `api/barrel-purity` is the other half.

`layer-occupancy` is the filesystem-aware complement to the per-file rule `boundary/db-isolation`.
`db-isolation` says which layers may touch the DB at all, statically and for every feature alike.
`layer-occupancy` gets stricter as a feature grows layers. At adoption it reports most of its
findings against the features that have the most layers. Only a feature with several layers can
bypass one, and there is no exclusion list.

The coverage of both checks is the coverage of the import graph. An import spelling that
`graph/import-graph` does not reveal is an edge that neither check receives.

Adoption mechanics, the spec contract, and what part of the tree owns each rule's subject: [../../overview.md](../../overview.md).
