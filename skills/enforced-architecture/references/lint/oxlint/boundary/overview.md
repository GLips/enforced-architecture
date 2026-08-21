# boundary — Layer direction and import restrictions

The per-file half: each rule reads one file's specifiers. The whole-tree half — which resolves
where a specifier actually lands — is in
[../../structural/boundary/overview.md](../../structural/boundary/overview.md), and you need it:
every rule here but one matches an import path, so a relative import reaching the same module by a
different spelling bypasses all of them at once. Adopt `boundary/import-policy` alongside the
first path-matching rule you take — **both halves of it**, since the two adapters read one table and
either alone governs one spelling.

`import-policy` is one rule where a tag like this usually has five: shared purity, shared-ui purity,
domain purity, feature barrel depth and route reach are each a *row* in one table rather than a rule
with its own path regexes. That is the shape to keep when adapting. Split them back into
per-directory rules and the overlaps go private again — each one deciding for itself what counts as
`shared/`, and the edges between them owned by nobody, which is where the answers drift apart
without anything failing.

The exception is `ambient-globals`, and it exists because import matching has a blind spot the rest
of the tag cannot see into. `fetch`, `localStorage`, `location` and `process.env` are never imported
— they are simply in scope — so no rule reading specifiers can fence one, and a module that reaches
a network, a disk or the environment does it with an import list that shows nothing.
`ambient-globals` is the one rule here that matches *references* instead of specifiers, which is why
its policy is a config map rather than a path regex.

| Rule | Blocking | What it buys |
|---|---|---|
| [import-policy](import-policy.ts) | Yes | A feature and a domain are reached at their barrel, `@/env.server` reaches no client file, and a domain takes no runtime package — one [table](../../policy/import-policy.ts) decides all of it |
| [db-isolation](db-isolation.ts) | Yes | Every query sits in three directories, and the build puts no database driver in the browser bundle |
| [route-thinness](route-thinness.ts) | Yes | A framework migration rewrites `src/routes/` with no query and no secret to move |
| [sdk-containment](sdk-containment.ts) | Yes | One file to change a vendor's API version or payload, and no server SDK in the browser bundle — [owner rows](../../policy/package-owners.ts) |
| [client-server-infra](client-server-infra.ts) | Yes | One short list tells you what the browser takes from `src/infrastructure/` |
| [server-no-upward](server-no-upward.ts) | Yes | `src/infrastructure/` moves to a worker or a package, and no feature code comes with it |
| [no-test-imports](no-test-imports.ts) | Yes | You rewrite a fixture or delete a helper, and only tests break |
| [ambient-globals](ambient-globals.ts) | Yes | One reader for `process.env`, `fetch` and `localStorage`, so a missing variable fails at boot in `@/env`. Matches references, not import specifiers |

Adoption mechanics, the spec contract, and what part of the tree owns each rule's subject: [../../overview.md](../../overview.md).
