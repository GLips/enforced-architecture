# api — Public API surface and barrel conventions

The whole-tree half. Both checks below answer a question about a barrel that no single file
contains: what the barrel transitively pulls in, and whether the importee agreed to the edge. The
per-file rules that match a specifier's depth are in
[../../oxlint/api/overview.md](../../oxlint/api/overview.md).

| Rule | Blocking | What it buys |
|---|---|---|
| [barrel-purity](barrel-purity.ts) | Yes | No client-safe barrel reaches a server-only package through its re-exports |
| [feature-visibility](feature-visibility.ts) | Mixed | Every import from one feature into another has an entry, with a written reason, in the importee's `visibility.json` |

`barrel-purity` stops its trace at a module that holds a `serverFnMarkers` string. A plain export in
that module can still reach a server-only package, and this check does not report it. The oxlint
rule `placement/no-plain-export-in-server-fn-module` makes that stop more safe, so take the pair.
The pair is still not a proof: a function declared on one line and exported on a later line needs
the two correlated by name, and a per-file pattern cannot do that.

A bundler finds the same chain, but only at build time, and its error names the last package in the
chain. `barrel-purity` reports the barrel to change, and it runs before a commit.

Take `feature-visibility` when the repository has two or more features and agents write most of the
code. The rule adds a file to every feature. If the features are few and stable, and a person reads
every import, the `graph/feature-deps` thresholds alone cost less.

`feature-visibility` is not cycle detection. It asks whether one edge is intended;
`graph/feature-deps` asks what shape the set of allowed edges makes. `graph/feature-deps` runs after
it and does not read the grants, thus a cycle of fully granted edges still fails. A `visibility.json`
that collects more and more grants is the same signal as an edge count that goes up in
`graph/feature-deps`: the split between the features is on the wrong axis.

Adoption mechanics, the spec contract, and what part of the tree owns each rule's subject: [../../overview.md](../../overview.md).
