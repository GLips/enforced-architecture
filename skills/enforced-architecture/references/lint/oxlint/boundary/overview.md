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

| Rule | Blocking | What it prevents |
|---|---|---|
| [import-policy](import-policy.ts) | Yes | Every aliased or bare-package import judged against one `SourceProfile × TargetArea` table in [../../policy/import-policy.ts](../../policy/import-policy.ts). Feature and domain barrel depth, shared and shared-ui purity, domain runtime purity, route reach — one row each |
| [db-isolation](db-isolation.ts) | Yes | Code outside data-access layers importing DB modules directly |
| [route-thinness](route-thinness.ts) | Yes | Routes importing DB, raw SDKs, or infrastructure internals |
| [sdk-containment](sdk-containment.ts) | Yes | Direct SDK imports outside the modules that own them, per [../../policy/package-owners.ts](../../policy/package-owners.ts) |
| [client-server-infra](client-server-infra.ts) | Yes | Client contexts importing server-only infrastructure modules |
| [server-no-upward](server-no-upward.ts) | Yes | Controllers/server code importing from UI or route layers |
| [no-test-imports](no-test-imports.ts) | Yes | Production code importing from test files |
| [ambient-globals](ambient-globals.ts) | Yes | Restricted runtime globals (`process.env`, `fetch`, `localStorage`) read outside the module that owns each. Matches references, not import specifiers |

Adoption mechanics, the spec contract, and cross-tag rule selection: [../../overview.md](../../overview.md).
