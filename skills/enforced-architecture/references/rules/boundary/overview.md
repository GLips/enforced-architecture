# boundary — Layer direction and import restrictions

Every rule here but one matches an import path, so a relative import reaching the same module by a different spelling bypasses all of them at once. Adopt `cross-boundary-alias` alongside the first path-matching rule you take.

The exception is `ambient-globals`, and it exists because import matching has a blind spot the rest of the tag cannot see into. `fetch`, `localStorage`, `location` and `process.env` are never imported — they are simply in scope — so no rule reading specifiers can fence one, and a module that reaches a network, a disk or the environment does it with an import list that shows nothing. `ambient-globals` is the one rule here that matches *references* instead of specifiers, which is why its policy is a config map rather than a path regex.

| Rule | Mechanism | Blocking | What it prevents |
|---|---|---|---|
| [db-isolation](db-isolation.ts) | oxlint | Yes | Code outside data-access layers importing DB modules directly |
| [domain-purity](domain-purity.ts) | oxlint | Yes | Domains using aliased or package runtime imports outside domains and shared |
| [route-thinness](route-thinness.ts) | oxlint | Yes | Routes importing DB, raw SDKs, or infrastructure internals |
| [shared-ui-purity](shared-ui-purity.ts) | oxlint | Yes | Shared UI gaining feature, domain, or infrastructure dependencies |
| [shared-purity](shared-purity.ts) | oxlint | Yes | Shared utilities importing app modules (features, domains, etc.) |
| [sdk-containment](sdk-containment.ts) | oxlint | Yes | Direct SDK imports outside designated infrastructure wrappers |
| [client-server-infra](client-server-infra.ts) | oxlint | Yes | Client contexts importing server-only infrastructure modules |
| [cross-boundary-alias](cross-boundary-alias.md) | Script | Yes | Relative imports that cross a boundary — a bypass for every rule that matches the aliased path. Consumes the import graph |
| [server-no-upward](server-no-upward.ts) | oxlint | Yes | Controllers/server code importing from UI or route layers |
| [no-test-imports](no-test-imports.ts) | oxlint | Yes | Production code importing from test files |
| [layer-occupancy](layer-occupancy.md) | Script | Yes | Bypassing present layers (e.g., controllers importing schema when repo/ exists, or importing repo when service/ exists) |
| [ambient-globals](ambient-globals.ts) | oxlint | Yes | Restricted runtime globals (`process.env`, `fetch`, `localStorage`) read outside the module that owns each. Matches references, not import specifiers |

Adoption mechanics, the spec contract, and cross-tag rule selection: [../overview.md](../overview.md).
