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

When in doubt, enforce. Every judgment call below resolves against this asymmetry.

---

## The Invariants

Non-negotiable properties of the architecture. Everything else is convention that adapts to the project. Six of the eight have a rule that enforces them; the rule doc says what it prevents and how to adapt it.

1. **Dependency direction is enforced.** Lower layers never import upper layers. No exceptions. — [layer model](#the-layer-model), [rules/boundary/](rules/boundary/overview.md)
2. **Database access is concentrated.** Only designated data access modules import the database. — [server functions as the DB boundary](#server-functions-as-the-db-boundary), [rules/boundary/db-isolation.ts](rules/boundary/db-isolation.ts)
3. **Features expose public APIs.** External consumers import through barrels, never internal paths. A feature that reorganizes internally breaks no consumer. — [import-boundaries.md](import-boundaries.md#public-api-convention-table), [rules/api/feature-public-api.ts](rules/api/feature-public-api.ts)
4. **SDKs are contained.** Every third-party SDK is either wrapped or layer-restricted. — [SDK containment](#sdk-containment)
5. **Cross-boundary imports use aliases.** — [the cross-boundary alias rule](#the-cross-boundary-alias-rule)
6. **Rules are blocking.** — [principle 4](#4-all-rules-blocking-from-day-one)
7. **The filesystem is the source of truth.** Directory structure plus the import graph fully describe the architecture. No metadata layers, no configuration-driven topology. Nothing enforces this — it is the constraint on whoever designs the architecture, and it is what rules out a topology manifest as a solution to any problem below.
8. **Tests are exempt; production is not.** Tests may cross boundaries for setup. Production code may never import test files. — [test placement](#test-placement)

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

Two consequences of taking the filesystem as the source of truth (invariant 7). Directory names *are* the naming convention — if a directory is called `controllers/`, the files in it are controllers, and an agent needs no config file to know that. And a layer's name is fixed project-wide: a codebase calling it `server/` here, `controllers/` there and `api/` in a third place is three architectures pretending to be one, and an agent will pick whichever it saw last.

### 3. Anti-ceremony

Architecture has a tax. Every layer costs readability. Every abstraction costs discoverability. Every indirection costs debugging time. These costs are real and they compound.

The goal is not maximum structure. It is the minimum structure that maintains dependency invariants. Two controls prevent architecture from becoming ceremony.

**Optional layer occupancy.** Layers exist in a fixed logical order, but physical presence is optional. A feature with two files and no complex data access does not need four directories. What makes this safe rather than sloppy is that occupancy is enforced: a layer that exists may not be bypassed, and a layer that does not exist costs nothing — see [rules/boundary/layer-occupancy.md](rules/boundary/layer-occupancy.md). Never scaffold empty directories, never create `.gitkeep` files, never create a layer "because we might need it later."

**No-trampoline policy.** A layer function must add at least one of: domain-level validation, authorization or policy enforcement, orchestration of multiple dependencies, data mapping, error normalization or retry, telemetry boundary behavior. If it does none of these it is a trampoline. Do not add `repo/` or `service/` until it earns directory-wide use from controllers; restructure or remove the layer instead of bypassing it.

### 4. All rules blocking from day one

Agents do not distinguish warnings from errors in their behavior. A warning says "this might be wrong," and an agent treats "might be wrong" identically to "is fine" because neither one blocks progress. The violation persists, gets committed, gets copied.

Every rule is either enforced (blocking, exit code 1) or not yet implemented. The only valid exceptions are **graduated thresholds** (a warning tier in front of a hard limit) and **heuristic checks** that need semantic judgment, where false positive rates would be too high to block on.

Invalid reasons, all three of which are the cost asymmetry misread:

- "We'll enforce it later." Violations accumulate exponentially. By the time "later" arrives, enforcement requires a migration.
- "It might have false positives." A false positive costs minutes; a missed violation costs days.
- "It's just a best practice." If it matters enough to check, it matters enough to block. If it doesn't matter enough to block, don't check it.

### 5. Domain-agnostic enforcement

The architecture defines structural boundaries, not feature-specific behavior. It should say that server functions live in `controllers/` and may not import UI components. It should not say how a specific feature structures its mutation logic.

Feature-internal conventions belong in feature implementation plans. The architecture provides the container; the feature fills it. This is what keeps the rule set from growing linearly with the number of features.

### 6. Enforce on the import graph, not the runtime graph

What matters is what a file imports, not whether that code executes. A file importing the database client is a violation even in a dead code path, and a dynamic import of a restricted module is a violation even if never triggered.

Static analysis does not need to model runtime control flow. Its guarantees cover the import forms the shared extractor represents, and an extraction gap that is not documented is a hole nobody knows about — see [rules/graph/import-graph.md](rules/graph/import-graph.md).

---

## The Layer Model

Layers are defined by responsibility, not by directory name. Every project adapts the names. What matters is the dependency direction and the separation of concerns.

**Transport.** The thinnest possible layer — renders UI, handles navigation, loads data by calling features. No business logic, no direct database access, no SDK usage. It must stay thin because it is the most framework-coupled code in the system: a framework migration rewrites it entirely, and that migration is mechanical only if the layer holds nothing but calls into features.

**Features.** Vertical domain slices, and the main unit of organization. A feature owns everything needed to deliver a piece of product functionality — server functions, client UI, data access, validation. The unit of ownership is "the billing feature," not "the server functions layer."

Features have an internal logical order, `ui --> controllers --> service --> repo`, with physical presence optional. They communicate through public API barrels (invariant 3). The barrel buys two things: internal restructuring becomes invisible to consumers, and exposure becomes a deliberate decision — without one, every file in the feature is public surface and internal helpers stay internal only because someone chose not to export them. Conventions and the two-barrel split: [import-boundaries.md](import-boundaries.md#public-api-convention-table).

**Domains (optional).** Pure business logic: no side effects, no framework dependencies, no database, no SDK clients, no environment variables. Domain functions accept dependencies as parameters — one that needs to check permissions takes a permission-checking function as an argument rather than importing the auth system.

The cost is that callers must resolve infrastructure adapters and pass them in, once per call site. The benefit is that domain logic becomes the most portable and testable code in the system — unit tested without mocking, understood without knowing the schema. Create a domain when business logic is complex enough that mixing it with infrastructure makes the code harder to understand. Simple CRUD features do not need one.

**Infrastructure.** Adapters for external systems: the database client, auth middleware, SDK wrappers, telemetry, email, payments. This is where environment variables live, where API keys are read, where connection pools are created — deliberate concentration, so security-sensitive configuration has exactly one home. Infrastructure never imports features, domains, or transport. If it needs to know about a feature, the dependency is inverted and the feature passes what it needs as a parameter.

**Shared.** Pure utilities, constants, type helpers, reusable UI primitives. No side effects, no infrastructure imports. Everything may import shared; shared imports nothing above it. The bar is high: a date formatter that works on any date belongs here, one that formats according to a feature's display rules belongs in that feature.

### Dependency direction

Lower layers never import upper layers. This is the fundamental invariant, and every enforcement rule ultimately serves to protect this graph.

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

---

## Server Functions as the DB Boundary

The most important architectural boundary in a full-stack application. Server functions — or the equivalent data access layer — are the single point of database access, input validation, and auth enforcement. No client-side code may import the database.

Database imports scattered across routes, UI, and utilities leave a codebase with no API surface: a schema change means auditing every file that might touch it, auth checks get duplicated or forgotten, validation is copy-pasted or absent. Concentrating access gives one place to enforce auth, one place to validate input, one interface that absorbs schema changes, and a server/client split the bundler can see from the directory alone.

### Why this matters for SSR frameworks

SSR blurs the server/client line: code that runs on the server during SSR also runs on the client during hydration and navigation. A component importing the database client works perfectly during SSR — the import resolves, the query runs, the data appears — and breaks only when the client bundler tries to put a database driver in the browser. It works in development and fails in production, and that feedback loop is long enough for the pattern to spread first.

The hydration variant is subtler. A component importing a server-only module renders and ships HTML fine; hydration then re-executes it, imports included, and fails. Depending on the framework that surfaces as a build error (caught before deployment), a runtime error on navigation (caught by users), or a silent mismatch where the client drops the server-rendered content.

Only the first is caught by the bundler. The other two are caught only by rules that stop the import existing at all — which is why framework protection and architecture rules both run and deliberately overlap on DB isolation. See [server-client-boundaries.md](server-client-boundaries.md#two-boundaries) for which mechanism is primary for what.

### Schema ownership vs. query ownership

**Schema belongs to infrastructure** — table definitions, column types, relations, and migrations in one centralized location. Non-negotiable: migration tooling requires it, foreign keys cross domain boundaries, and one location is the only way to see all tables at once.

**Queries belong to features.** Each feature's data access layer writes against the shared schema and decides how to join, filter, and project.

So features own their queries, not their tables. Adding a table means adding it centrally, then querying it from the feature that needs it. This reads backwards if you are used to feature-owned migrations, and it is the only model that survives cross-domain foreign keys.

The same logic governs data another feature owns: technically any repo can import any table, but a feature that needs another feature's data calls that feature's server API rather than writing its own query. The owning feature controls how its data is exposed, including auth, validation, and query optimization — and a project can put *who may consume it* under the owner's control too, see [rules/api/feature-visibility.md](rules/api/feature-visibility.md).

---

## SDK Containment

Third-party SDKs carry their own configuration, their own API surfaces, and their own breaking-change schedules. Left free to scatter, configuration duplicates, API key management decentralizes, and a version upgrade means touching every file that imports the package.

So every SDK is contained one of two ways — wrapped behind an infrastructure module, or layer-restricted to the directories allowed to import it raw. Classifying each one is a Phase 2 decision with no mechanical answer. The wrapper is containment, not abstraction: it configures the SDK and re-exports its interface rather than hiding it behind a generic one.

The two strategies, when each applies, and how to add a new SDK: [import-boundaries.md](import-boundaries.md#sdk-containment).

---

## Error Architecture

Features define a single error class with a typed code discriminant. No hierarchies, no base classes with subclasses, no error-per-use-case. Controllers switch on `error.code` to determine HTTP status, which TypeScript makes exhaustive: renaming a code is a type error rather than a silent regression. Never switch on `error.message` — message strings are for humans reading logs, and code that branches on them is one typo away from a silent bug and one rewrite away from a regression.

Do not create error types speculatively. Start with one, and add per-layer types when you find yourself mapping between error semantics at multiple boundaries — a configurable choice, see [directory-model.md](directory-model.md#choice-4-error-architecture).

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

## UI Ownership

Components are placed by ownership, not by visual complexity.

| Location | Contents | Restrictions |
|---|---|---|
| Shared UI directory | Generic primitives reusable across features. Buttons, modals, form inputs, layout components. | Must not import features, domains, or infrastructure. |
| Feature UI directory | Feature-specific UI carrying feature semantics. A billing invoice component, a chat message bubble. | May import from its own feature and shared UI. Must not import other features' UI. |
| Transport (routes) | Composes feature and shared UI into pages. | Does not define business UI components. |

Cross-feature UI is banned. When Feature A needs something in Feature B's UI directory, either **duplicate it** — cheaper than premature abstraction when the two features' needs will diverge — or **promote it to shared**, once the rule of three is met and the component carries no business imports.

---

## File Size Discipline

Large files are architecture smells: a file past a few hundred lines is doing too many things or working at too many levels of abstraction. Enforce it mechanically, with graduated thresholds — a warning that gives an agent room to split as part of work it is already doing, and a hard failure behind it. Hitting the hard limit should be rare when the warning is calibrated.

Exceptions go in one centralized list with a TODO each, never as per-file ignore comments. Scattered exemptions are invisible; a list is auditable. Thresholds and exclusions: [rules/health/file-size.md](rules/health/file-size.md).

---

## Evolution and Extension

**Features graduate on need, not forecast.** A feature adds a layer when the code demands it, never because it "might" — that is optional layer occupancy doing its job. Tiers and their triggers: [feature-patterns.md](feature-patterns.md#graduation-triggers).

**Code migrates outward when a pattern emerges, and the threshold is always three.** Two occurrences is coincidence; three is a pattern. It applies uniformly — UI to shared, a utility to shared, business logic to a domain, repeated controller orchestration down into a service. Holding the line at three is what prevents premature abstraction, the most expensive form of over-engineering: it constrains every future change to fit a shape designed before anyone knew enough.

**Migration is decomposed into atomic phases**, each producing a repo that passes every rule active at that point. Rules never activate before the structure that makes them passable. No shims, no compatibility layers, no re-exports that exist only to avoid updating imports. Sequencing and phase templates: [migration-patterns.md](migration-patterns.md).

**A complex feature may define its own internal rules**, namespaced to the feature and scoped to its directory tree. The base architecture provides the container; feature rules fill it. That split is what keeps the base rule set from growing with the number of features.
