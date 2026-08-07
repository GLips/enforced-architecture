# Architecture Principles

The worldview behind mechanically enforced architecture: what the layers are, why they are separated where they are, and what may never be traded away. Every other reference handles specifics — this one handles *why*, and points at the specific doc rather than restating it.

Written for AI agent readers. Agents are the primary code writers and the primary consumers of this architecture.

---

## Core Philosophy

Convention-based architecture fails when agents write most of the code.

This creates a cost asymmetry that drives every enforcement decision:

| Outcome | Cost |
|---|---|
| False positive: agent hits a rule, pauses, asks for guidance | Minutes |
| Violation escapes, gets copied as a pattern across 20 files | Days |
| Structural decay becomes load-bearing (tests depend on it, features assume it) | Weeks to unwind |

Every enforcement decision should be evaluated against this asymmetry. When in doubt, enforce. The cost of a rule that occasionally blocks a valid change is trivial compared to the cost of a violation that becomes a pattern.

---

## Foundational Principles

### 1. Mechanical enforcement is knowledge transfer

The enforcement pipeline is the onboarding process:

- **If a constraint isn't enforced by tooling, it doesn't exist for agents.** It will be violated. Not maliciously, not carelessly, just inevitably. The agent that violates it will have no signal that anything went wrong.
- **Rules must be self-documenting.** The error message is the documentation. An agent should be able to fix any violation from the error message alone, without reading any reference document.
- **The first edit is validated by the same rules as the hundredth.** There is no ramp-up period.

### 2. Predictable structure enables autonomous navigation

An agent should answer "where does this code live?" from directory structure alone.

If a convention holds everywhere, agents navigate autonomously. If it holds "mostly," they cannot. "Mostly" is worse than "never" because it creates false confidence. An agent that finds a pattern in three files and sees it absent in a fourth will either reproduce the inconsistency or try to "fix" the fourth file. Both outcomes are wrong.

The filesystem is the source of truth:

- **No topology manifests.** No metadata files that describe what lives where. The directory structure plus the import graph tell you everything about the architecture.
- **Directory names are the naming convention.** If a directory is called `controllers/`, the files in it are controllers. If a feature has a `repo/` directory, it has a data access layer. If it doesn't, it doesn't.
- **No configuration-driven structure.** An agent should not need to read a config file to know that server functions live in `controllers/`. The directory name tells it.

Two consequences. Every feature of the same complexity tier looks the same, so an agent that understands one understands all of them — a structural surprise is an architectural bug. And a layer's name is fixed project-wide: a codebase calling it `server/` here, `controllers/` there and `api/` in a third place is three architectures pretending to be one, and an agent will pick whichever it saw last.

### 3. Anti-ceremony

Architecture has a tax. Every layer costs readability. Every abstraction costs discoverability. Every indirection costs debugging time. These costs are real and they compound.

The goal is not maximum structure. The goal is minimum structure that maintains dependency invariants. Two controls prevent architecture from becoming ceremony:

#### Optional layer occupancy

Layers exist in a fixed logical order, but physical presence is optional. A feature with two files and no complex data access does not need four directories. A domain with pure computation and no external dependencies does not need an infrastructure adapter.

What makes this safe rather than sloppy is that occupancy is enforced: a layer that exists may not be bypassed, and a layer that does not exist costs nothing. See [rules/boundary/layer-occupancy.md](rules/boundary/layer-occupancy.md).

Never scaffold empty directories. Never create `.gitkeep` files. Never create a layer "because we might need it later." Create layer directories when they have active code, not before.

#### No-trampoline policy

A layer function must justify its existence. It must add at least one of:

- Domain-level validation
- Authorization or policy enforcement
- Orchestration of multiple dependencies
- Data mapping or transformation
- Error normalization or retry logic
- Telemetry boundary behavior

If a function does none of these, it is a trampoline. Do not add `repo/` or `service/` until it earns directory-wide use from controllers; restructure or remove the layer instead of bypassing it.

### 4. All rules blocking from day one

Agents do not distinguish warnings from errors in their behavior.

A warning says "this might be wrong." An agent treats "might be wrong" identically to "is fine" because neither one blocks progress. The violation persists, gets committed, gets copied. By the time a human notices the warning in CI output, the pattern has spread.

Every rule is either enforced (blocking, exit code 1) or not yet implemented. There is no middle ground. The only valid exceptions:

- **Graduated thresholds** — File size warnings before the hard fail limit, giving agents a signal to split proactively before they hit the wall.
- **Heuristic checks** — Checks that require semantic judgment (like trampoline detection) where false positive rates would be too high for blocking enforcement.

Invalid reasons for non-blocking rules:

- "We'll enforce it later." Violations accumulate exponentially. By the time "later" arrives, enforcement requires a migration.
- "It might have false positives." A false positive costs minutes. A missed violation costs days. Calibrate against the cost asymmetry.
- "It's just a best practice." If it matters enough to check, it matters enough to block. If it doesn't matter enough to block, don't check it.

### 5. Domain-agnostic enforcement

The architecture defines structural boundaries. It does not define feature-specific behavior.

An architecture document should tell you that server functions live in `controllers/` and that they may not import UI components. It should not tell you how a specific feature structures its mutation logic or what its internal state management looks like.

Feature-internal conventions belong in feature implementation plans. The architecture provides the container; the feature fills it. This separation keeps the enforcement rules general-purpose and prevents the rule set from growing linearly with the number of features.

### 6. Enforce on the import graph, not the runtime graph

Static import analysis is the enforcement mechanism. It does not matter whether code actually executes at runtime — what matters is what it imports. A file that imports the database client is a violation even if the import is used only in a dead code path. A file that dynamically imports a restricted module is a violation even if the dynamic import is never triggered.

Static analysis does not need to model runtime control flow. Its guarantees cover the import forms the shared extractor represents, and an extraction gap that is not documented is a hole nobody knows about — see [rules/graph/import-graph.md](rules/graph/import-graph.md).

---

## The Layer Model

The model defines layers by responsibility, not by specific directory names. Every project adapts the layer names to its conventions. What matters is the dependency direction and the separation of concerns.

### Transport

The thinnest possible layer. Renders UI, handles navigation, loads data by calling features. Contains no business logic, no direct database access, no SDK usage.

Transport exists because frameworks demand it — routes, pages, CLI entry points — and it adapts the framework's conventions into calls to the feature layer.

Why it must be thin: transport is the most framework-coupled code in the system, and a framework migration rewrites it entirely. If it holds only calls to features, that migration is mechanical; if it holds business logic, that logic has to be extracted first. It is also the most variable layer between projects, and nothing below it should care which transport shape a project chose.

### Features

Vertical domain slices. The main unit of organization.

A feature owns everything needed to deliver a piece of product functionality: server functions, client UI, data access, validation. Features are the unit of product ownership — "the billing feature," not "the server functions layer."

Features have an internal layer model:

```
ui --> controllers --> service --> repo
```

This is the logical order. Physical presence is optional (see anti-ceremony above). A simple feature may have only `controllers/` and a barrel. A complex feature may have all four layers plus feature-specific sub-modules.

Features communicate through public API barrels. Feature A never reaches into Feature B's internal directories. If Feature A needs data from Feature B, it imports Feature B's public API. This means Feature B controls what it exposes, and Feature A's imports survive Feature B's internal restructuring.

#### Public API barrels

The barrel is the feature's contract, and it buys two things. Internal restructuring becomes invisible to consumers — split a file, rename an internal function, add a layer, and nothing outside changes. And exposure becomes a deliberate decision: without a barrel every file in the feature is public surface, so internal helpers stay internal only because someone chose not to export them.

Conventions, the two-barrel split, and what may cross: [import-boundaries.md](import-boundaries.md#public-api-convention-table).

### Domains (optional)

Pure business logic. No side effects, no framework dependencies, no database access, no SDK clients, no environment variables.

Domain functions accept dependencies as parameters when they need external capabilities. A domain function that needs to check permissions accepts a permission-checking function as an argument — it does not import the auth system.

Domains exist when business logic is complex enough to justify separation from features. Simple CRUD features with no complex business rules do not need a domain layer. The cost of domains is that callers must resolve infrastructure adapters and pass them in — a one-time wiring cost per call site.

The benefit is profound: domain logic is the most portable, testable, and understandable code in the system. It can be unit tested without mocking infrastructure. It can be understood without understanding the database schema. It can be reused across features without dragging infrastructure dependencies along.

Not every project needs domains. Not every feature in a project that has domains needs to use them. Create a domain when the business logic is complex enough that mixing it with infrastructure concerns makes the code harder to understand.

### Infrastructure

Adapters for external systems. The database client, auth middleware, SDK wrappers, telemetry, email services, payment processing. Infrastructure is configured once and consumed by features.

Infrastructure is where environment variables live. It is where API keys are read, where connection pools are created, where SDK clients are instantiated. This concentration is deliberate: security-sensitive configuration has exactly one home, and that home is not scattered across feature directories.

Infrastructure never imports features, domains, or transport. It is a service provider, not a service consumer. If infrastructure code needs to know about a feature, the dependency is inverted — the feature passes what infrastructure needs as a parameter.

### Shared

Pure utilities, constants, type helpers, and reusable UI primitives. No side effects, no infrastructure imports.

Shared is the bottom of the application stack (alongside infrastructure). Everything may import shared. Shared imports nothing above it.

The bar for placing code in shared is high: it must be genuinely generic. A date formatting function that works on any date belongs in shared. A date formatting function that formats dates according to a specific feature's display rules belongs in that feature.

### Dependency direction

Lower layers never import upper layers. This is the fundamental invariant. Every enforcement rule ultimately serves to protect this graph.

```
Transport
   |
   v
Features ----> Domains (optional)
   |              |
   v              v
Infrastructure    Shared
   |
   v
 Shared
```

All layers may import from shared. No layer may import a layer that depends on it. Circular dependencies between layers are architecture bugs, not implementation details.

### Why this specific layering

The layer model is not novel. It is a simplified port-and-adapter architecture without the ceremony of explicit port interfaces. The layers exist because they map to real-world concerns that change at different rates:

- **Transport changes** when you swap frameworks, add API versions, or restructure URL schemes.
- **Features change** when product requirements change — new screens, new workflows, new server endpoints.
- **Domains change** when business rules change — new validation logic, new computation, new invariants.
- **Infrastructure changes** when you swap providers, upgrade SDKs, or add new external systems.
- **Shared changes** rarely — utilities and constants are stable by definition.

Layers that change for different reasons should not be coupled. A change to the payment provider should not require changes in the route layer. A change to URL structure should not require changes in business logic. The layer model enforces this separation.

---

## Server Functions as the DB Boundary

This is the most important architectural boundary in a full-stack application.

Server functions (or the equivalent data access layer — repo modules, server actions) are the single point of database access, input validation, and auth enforcement. No client-side code — routes, UI components, client data layers — may import the database.

```
Client-side code (routes, UI, client state)
              |
              | (call server functions / use public API)
              v
Server functions / repo layer
              |
              | (import DB client, run queries)
              v
          Database
```

### Why this matters for SSR frameworks

SSR blurs the server/client line: code that runs on the server during SSR also runs on the client during hydration and navigation. A component importing the database client works perfectly during SSR — the import resolves, the query runs, the data appears — and breaks only when the client bundler tries to put a database driver in the browser. It works in development and fails in production, and that feedback loop is long enough for the pattern to spread first.

The hydration variant is subtler still. A component importing a server-only module renders and ships HTML fine; hydration then re-executes it, imports included, and fails. Depending on the framework that surfaces as a build error (caught before deployment), a runtime error on navigation (caught by users), or a silent mismatch where the client drops the server-rendered content.

Only the first is caught by the bundler. The other two are caught only by rules that stop the import existing at all — which is why framework protection and architecture rules both run and deliberately overlap on DB isolation. See [server-client-boundaries.md](server-client-boundaries.md#two-boundaries) for which mechanism is primary for what.

### Why a single boundary point

Database imports scattered across routes, UI, and utilities leave a codebase with no API surface: a schema change means auditing every file that might touch it, auth checks get duplicated or forgotten, validation is copy-pasted or absent. Concentrating access in one layer gives a single place to enforce auth, a single place to validate input, one interface that absorbs schema changes on behalf of consumers, and a server/client split the bundler can see from the directory alone.

### Schema ownership vs. query ownership

**Schema belongs to infrastructure** — table definitions, column types, relations, and migrations in one centralized location. Non-negotiable: migration tooling requires it, foreign keys cross domain boundaries, and one location is the only way to see all tables at once.

**Queries belong to features.** Each feature's data access layer writes against the shared schema and decides how to join, filter, and project.

So features own their queries, not their tables. Adding a table means adding it centrally, then querying it from the feature that needs it. This reads backwards if you are used to feature-owned migrations, and it is the only model that survives cross-domain foreign keys.

---

## SDK Containment

Third-party SDKs carry their own configuration, their own API surfaces, and their own breaking-change schedules. Left free to scatter, configuration duplicates, API key management decentralizes, and a version upgrade means touching every file that imports the package.

So every SDK is contained one of two ways — wrapped behind an infrastructure module, or layer-restricted to the directories allowed to import it raw. The wrapper is containment, not abstraction: it configures the SDK and re-exports its interface rather than hiding it behind a generic one.

The two strategies, when each applies, and how to add a new SDK: [import-boundaries.md](import-boundaries.md#sdk-containment).

---

## Error Architecture

### One error class at the server boundary

Features define a single error class with a typed code discriminant. No hierarchies, no base classes with subclasses, no error-per-use-case. Controllers switch on `error.code` to determine HTTP status, which TypeScript makes exhaustive: renaming a code is a type error rather than a silent regression.

Whether to add per-layer error types is a configurable choice — see [directory-model.md](directory-model.md#choice-4-error-architecture).

### No message matching

Error message strings are for humans reading logs. They are not for machines determining behavior. Code that switches on `error.message` is one typo away from a silent bug and one message rewrite away from a regression.

```typescript
// Wrong — fragile, not exhaustive, breaks on message change
if (error.message.includes("not found")) {
  return new Response(null, { status: 404 })
}

// Right — exhaustive, refactor-safe, TypeScript-enforced
switch (error.code) {
  case "NOT_FOUND": return new Response(null, { status: 404 })
  case "FORBIDDEN": return new Response(null, { status: 403 })
  case "VALIDATION": return new Response(error.message, { status: 400 })
  case "CONFLICT": return new Response(null, { status: 409 })
}
```

Do not create error types speculatively. Start with one, and add per-layer types when you find yourself mapping between error semantics at multiple boundaries.

---

## Test Placement

**Tests live next to the code they test.** Co-location buys three things: an agent finds a file's tests without searching, tests move and die with their source rather than orphaning, and the relative import makes the relationship explicit.

**Tests are exempt from boundary rules.** A controller test may need to set up database state, create auth sessions, and assert against infrastructure. Enforcing boundaries there makes tests either impossible to write or full of dependency injection that exists solely to satisfy the linter. The exclusion is stated once for the whole system — see [enforcement-strategy.md](enforcement-strategy.md#global-test-exclusion) — never per rule.

**The reverse IS enforced.** Production code may never import from a test file. If it does, that utility is production code and belongs in the shared test infrastructure directory, which the same rule keeps production out of.

**Design for testability: functional core, imperative shell.** Domain logic is pure, so it needs no mocking. Infrastructure is injectable, so tests pass test implementations. Server functions are the integration boundary — test them against a real database where practical, and mock external APIs at the HTTP level rather than the SDK level.

---

## The Cross-Boundary Alias Rule

This is the rule that makes every other import-path rule work, and without it the enforcement system has a bypass vector.

Every import rule pattern-matches on the aliased path. "Files in `routes/` cannot import `@/infrastructure/db`" works because it can match that string — and `../../infrastructure/db` names the same module with a string the rule never sees. So all imports crossing a top-level boundary use the alias, and relative imports that traverse into another top-level directory are banned. Inside one boundary, relative imports are expected and correct: they cross nothing.

Treat this as the load-bearing one when sequencing a migration. Details and the check itself: [rules/boundary/cross-boundary-alias.md](rules/boundary/cross-boundary-alias.md).

---

## Cross-Module Data Access

Features must not query another feature's data by reaching into its internal modules. Cross-feature data access goes through the owning feature's public API.

```typescript
// Wrong — importing another feature's internal repo
import { fetchItems } from "@/features/inventory/repo/items"

// Right — importing through the public API
import { getItems } from "@/features/inventory/server"
```

This rule exists because internal restructuring must not break consumers. If Feature B reorganizes its repo layer, splits a file, renames a function — none of that should require changes in Feature A. The public API barrel absorbs internal changes. Consumers import a stable interface.

The same principle applies to database schema. Schema tables are owned by infrastructure, and technically any repo can import any table. But the architectural expectation is: if a feature needs data that another feature owns, it calls that feature's server API rather than writing its own query against the other feature's tables. The owning feature controls how its data is exposed, including auth, validation, and query optimization.

A public API decides *how* a feature may be consumed. Who may consume it is a further question, and a project can put that answer under the owning feature's control too — see [rules/api/feature-visibility.md](rules/api/feature-visibility.md).

---

## UI Ownership

Components are placed by ownership, not by visual complexity.

| Location | Contents | Restrictions |
|---|---|---|
| Shared UI directory | Generic primitives reusable across features. Buttons, modals, form inputs, layout components. | Must not import features, domains, or infrastructure. |
| Feature UI directory | Feature-specific UI carrying feature semantics. A billing invoice component, a chat message bubble. | May import from its own feature and shared UI. Must not import other features' UI. |
| Transport (routes) | Composes feature and shared UI into pages. | Does not define business UI components. |

### Cross-feature UI is banned

Features must not import each other's UI components. When Feature A needs something in Feature B's UI directory, either **duplicate it** — cheaper than premature abstraction when the two features' needs will diverge — or **promote it to shared**, once the rule of three above is met and the component carries no business imports.

---

## File Size Discipline

Large files are architecture smells: a file past a few hundred lines is doing too many things or working at too many levels of abstraction. Enforce it mechanically, with graduated thresholds — a warning that gives an agent room to split as part of work it is already doing, and a hard failure behind it. Hitting the hard limit should be rare when the warning is calibrated.

Exceptions go in one centralized list with a TODO each, never as per-file ignore comments. Scattered exemptions are invisible; a list is auditable. Thresholds and exclusions: [rules/health/file-size.md](rules/health/file-size.md).

---

## Evolution and Extension

**Features graduate on need, not forecast.** A feature adds a layer when the code demands it, never because it "might" — that is optional layer occupancy doing its job. Tiers and their triggers: [feature-patterns.md](feature-patterns.md#graduation-triggers).

**Code migrates outward when a pattern emerges, and the threshold is always three.** Two occurrences is coincidence; three is a pattern. It applies uniformly — UI to shared, a utility to shared, business logic to a domain, repeated controller orchestration down into a service. Holding the line at three is what prevents premature abstraction, which is the most expensive form of over-engineering: it constrains every future change to fit a shape designed before anyone knew enough.

**Migration is decomposed into atomic phases**, each producing a repo that passes every rule active at that point. Rules never activate before the structure that makes them passable. No shims, no compatibility layers, no re-exports that exist only to avoid updating imports. Sequencing and phase templates: [migration-patterns.md](migration-patterns.md).

**A complex feature may define its own internal rules**, namespaced to the feature and scoped to its directory tree. The base architecture provides the container; feature rules fill it. That split is what keeps the base rule set from growing with the number of features.

---

## Summary of Invariants

These are the non-negotiable properties of the architecture. Everything else is convention that can be adapted to the project.

1. **Dependency direction is enforced.** Lower layers never import upper layers. No exceptions.
2. **Database access is concentrated.** Only designated data access modules import the database. Everything else uses the public API.
3. **Features expose public APIs.** External consumers import through barrels, never through internal paths.
4. **SDKs are contained.** Every third-party SDK is either wrapped or layer-restricted. No SDK package is freely importable from anywhere.
5. **Cross-boundary imports use aliases.** Relative imports that cross top-level boundaries are banned. This makes all other import-path-based rules enforceable.
6. **Rules are blocking.** Every rule either blocks or is not yet implemented. Warnings are for graduated thresholds only.
7. **The filesystem is the source of truth.** Directory structure and import graph fully describe the architecture. No metadata layers, no configuration-driven topology.
8. **Tests are exempt; production is not.** Tests may cross boundaries for setup. Production code may never import test files.
