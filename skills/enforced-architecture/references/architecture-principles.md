# Architecture Principles

Philosophical foundation for mechanically enforced architecture in TypeScript codebases. This document establishes the worldview. Other references handle specifics: directory-model.md covers naming, rule-catalog.md covers enforcement rules, enforcement-strategy.md covers implementation.

Written for AI agent readers. Agents are the primary code writers and the primary consumers of this architecture.

---

## Core Philosophy

Convention-based architecture fails when agents write most of the code.

Agents are prolific and literal. They copy visible patterns, place code wherever seems locally convenient, and each reasonable-in-isolation decision compounds into structural decay. An agent that sees a database import in a route file will reproduce that pattern in every route it touches. An agent that sees a utility function in a feature directory will create more utilities there. No agent wakes up and decides to violate architecture. Every violation is a locally reasonable decision made without global context.

Humans manage this through culture, code review, and institutional memory. Agents have none of these. An agent's "institutional memory" is whatever it can observe in the codebase and whatever rules are mechanically enforced. Nothing else exists for it.

This creates a cost asymmetry that drives every enforcement decision:

| Outcome | Cost |
|---|---|
| False positive: agent hits a rule, pauses, asks for guidance | Minutes |
| Violation escapes, gets copied as a pattern across 20 files | Days |
| Structural decay becomes load-bearing (tests depend on it, features assume it) | Weeks to unwind |

Every enforcement decision should be evaluated against this asymmetry. When in doubt, enforce. The cost of a rule that occasionally blocks a valid change is trivial compared to the cost of a violation that becomes a pattern.

This is not a pessimistic view of agents. Agents are extraordinarily capable at implementing features, refactoring code, and solving complex problems. They are terrible at maintaining structural invariants across a codebase they didn't design. These are different skills, and the architecture must account for both.

---

## Foundational Principles

### 1. Mechanical enforcement is knowledge transfer

The enforcement pipeline IS the onboarding process. Rules are the knowledge transfer mechanism, not documentation, not code review culture, not team norms.

When an agent encounters a codebase for the first time, it has two sources of truth: the code it can read and the rules that block its mistakes. Documentation is advisory. Rules are authoritative. An agent that reads a document saying "don't import the database from routes" may or may not follow it. An agent that tries to import the database from a route and gets a blocking error WILL find another way.

This means:

- **If a constraint isn't enforced by tooling, it doesn't exist for agents.** It will be violated. Not maliciously, not carelessly, just inevitably. The agent that violates it will have no signal that anything went wrong.
- **Rules must be self-documenting.** The error message is the documentation. An agent should be able to fix any violation from the error message alone, without reading any reference document.
- **The first edit is validated by the same rules as the hundredth.** There is no ramp-up period, no grace for new agents, no "learn the codebase first" phase. The rules teach by blocking.

A well-enforced codebase is one where an agent with zero context can make structural changes and get immediate, actionable feedback when it goes wrong. The enforcement pipeline replaces the senior engineer who would have caught the mistake in review.

This has a corollary for error messages: **the error message is the fix instruction.** A message that says "import not allowed" teaches nothing. A message that says "Route files cannot import @/db. Use a server function from @/features/<name>/server instead" teaches the architecture one violation at a time. Every enforcement error should be written so an agent can fix the violation without reading any other document.

### 2. Predictable structure enables autonomous navigation

An agent should answer "where does this code live?" from directory structure alone.

If a convention holds everywhere, agents navigate autonomously. If it holds "mostly," they cannot. "Mostly" is worse than "never" because it creates false confidence. An agent that finds a pattern in three files and sees it absent in a fourth will either reproduce the inconsistency or try to "fix" the fourth file. Both outcomes are wrong.

The filesystem is the source of truth:

- **No topology manifests.** No metadata files that describe what lives where. The directory structure plus the import graph tell you everything about the architecture.
- **Directory names are the naming convention.** If a directory is called `controllers/`, the files in it are controllers. If a feature has a `repo/` directory, it has a data access layer. If it doesn't, it doesn't.
- **No configuration-driven structure.** An agent should not need to read a config file to know that server functions live in `controllers/`. The directory name tells it.

This has a practical consequence for how features are organized: every feature of the same complexity tier looks the same. An agent that understands one feature's structure understands all of them. Structural surprises are architectural bugs.

The predictability principle extends to naming. If a project calls its data access layer `repo/`, every feature calls it `repo/`. If the project uses `controllers/` for server functions, every feature uses `controllers/`. A codebase where one feature calls it `server/` and another calls it `controllers/` and a third calls it `api/` is three different architectures pretending to be one. An agent encountering it will pick whichever name it saw last.

### 3. Anti-ceremony

Architecture has a tax. Every layer costs readability. Every abstraction costs discoverability. Every indirection costs debugging time. These costs are real and they compound.

The goal is not maximum structure. The goal is minimum structure that maintains dependency invariants. Two controls prevent architecture from becoming ceremony:

#### Optional layer occupancy

Layers exist in a fixed logical order, but physical presence is optional. A feature with two files and no complex data access does not need four directories. A domain with pure computation and no external dependencies does not need an infrastructure adapter.

The rule: **skip absent layers; never bypass present ones.**

If a layer directory does not exist, the layers on either side connect directly. The moment you create a layer directory, all traffic must flow through it. This gives two properties simultaneously:

- No forced ceremony for simple features.
- Structural guarantees that strengthen automatically as features grow.

Never scaffold empty directories. Never create `.gitkeep` files. Never create a layer "because we might need it later." Create layer directories when they have active code, not before.

#### No-trampoline policy

A layer function must justify its existence. It must add at least one of:

- Domain-level validation
- Authorization or policy enforcement
- Orchestration of multiple dependencies
- Data mapping or transformation
- Error normalization or retry logic
- Telemetry boundary behavior

If a function does none of these — if it accepts the same arguments as the layer below and returns the same result without modification — it is a trampoline. Delete it. Let the caller reach through to the layer that does the actual work.

Trampolines are the most common form of architectural ceremony. They exist because someone created a layer and felt obligated to populate it. They add indirection without value, make the call stack harder to read, and create maintenance surface area for code that does nothing.

The optional layer occupancy policy makes trampolines unnecessary. If a feature doesn't need a service layer, don't create one. If a service layer exists but one of its functions is just forwarding a call, delete that function and let the controller call the repo directly for that operation.

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

Complex features may need internal layering rules beyond the base set. These are namespaced to the feature and documented in the feature's plan, not in the architecture reference.

### 6. Enforce on the import graph, not the runtime graph

Static import analysis is the enforcement mechanism. It does not matter whether code actually executes at runtime — what matters is what it imports. A file that imports the database client is a violation even if the import is used only in a dead code path. A file that dynamically imports a restricted module is a violation even if the dynamic import is never triggered.

This is deliberate. Static analysis is fast, reliable, and free of false negatives from runtime conditions. It also means the enforcement script does not need to understand control flow, conditional logic, or framework compilation. It reads imports and checks them against rules. That's it.

The enforcement pipeline runs on every save (via dev server import protection), every commit (via pre-commit hooks), and every push (via CI). Three layers of defense. A violation that escapes all three is a bug in the enforcement system, not an acceptable outcome.

---

## The Layer Model

The model defines layers by responsibility, not by specific directory names. Every project adapts the layer names to its conventions. What matters is the dependency direction and the separation of concerns.

### Transport

The thinnest possible layer. Renders UI, handles navigation, loads data by calling features. Contains no business logic, no direct database access, no SDK usage.

Transport exists because frameworks demand it — routes, pages, CLI entry points. The transport layer is framework-shaped. It adapts the framework's conventions (file-based routing, CLI argument parsing) into calls to the feature layer.

Why transport must be thin: transport is the most framework-coupled code in the system. When you migrate frameworks, transport is rewritten entirely. Everything it imports must survive that rewrite. If transport contains business logic, that logic must be extracted during migration. If transport only calls features, migration is mechanical.

Transport is also the most variable layer between projects. File-based routing, server-rendered pages, CLI commands, API endpoints — all transport, all shaped differently. The rest of the architecture should not care which transport pattern the project uses. Features, domains, infrastructure, and shared are framework-agnostic. Transport is not, and that's fine.

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

Every feature has at least one barrel file — the client-safe barrel. This exports types, pure functions, constants, and anything safe to import from client bundles. For projects with server/client bundle splitting, a second server-only barrel exports server functions, database queries, and infrastructure-dependent code.

The barrel is the feature's contract. Internal restructuring is invisible to consumers as long as the barrel's exports don't change. This is the property that makes features independently evolvable — you can split a file, rename an internal function, add a layer, and nothing outside the feature changes.

Barrels also enforce a deliberate exposure decision. Without barrels, every file in a feature is part of its public surface. With barrels, a feature must explicitly choose what to expose. Internal helpers stay internal by default.

The server-only barrel has an additional constraint: it must never be imported from client contexts. In SSR frameworks, this is enforced by file naming convention (`.server.ts`) and framework-level import protection. The architecture script enforces it as a layer rule: only server contexts may import server barrels.

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

SSR frameworks blur the server/client line. Code that runs on the server during SSR also runs on the client during hydration and navigation. A component that imports the database client will work perfectly during SSR — the import resolves, the query runs, the data appears. It breaks only when the client-side bundler tries to include the database driver in the browser bundle.

This failure mode is insidious because it works in development (where SSR handles everything) and breaks in production (where the client bundle is loaded separately). The feedback loop is long enough that the pattern can spread before anyone notices.

Mechanical enforcement eliminates this class of bugs entirely. If the database client cannot be imported from any file outside the designated data access layer, the problem cannot occur. The enforcement rule catches it on the first attempt, not after deployment.

### The SSR hydration trap

There is a subtler failure mode. A component that imports a server-only module will successfully SSR. The server renders it, sends HTML to the client, and the page appears. But during hydration, the client-side JavaScript tries to re-execute the component — including its imports. If those imports reference server-only modules, the hydration fails.

Depending on the framework, this manifests as:
- A build error (best case — caught before deployment)
- A runtime error on navigation (caught by users, not by developers)
- A silent hydration mismatch where the client silently drops the server-rendered content

The first case is caught by framework-level import protection. The second and third are caught only by architectural enforcement rules that prevent the import from existing in the first place. This is why both layers of enforcement (framework-level and architecture script) are necessary, and why they overlap on DB isolation — it's too important to rely on a single mechanism.

### Why a single boundary point

A codebase with database imports scattered across routes, UI components, and utility functions has no API surface. Any change to the database schema requires auditing every file that might touch it. Auth checks are duplicated or forgotten. Validation logic is copy-pasted or absent.

Concentrating database access in a single layer creates:

- **A single place to enforce auth.** Every database query flows through a function that can check permissions.
- **A single place to validate input.** Every mutation flows through a function that can validate data before it reaches the database.
- **A single API surface for data.** Features consume data through a defined interface. Schema changes are absorbed by the data access layer; consumers don't change.
- **A clear server/client boundary.** The bundler knows exactly which code is server-only because it's in a designated directory, not scattered everywhere.

### Schema ownership vs. query ownership

A common question: if database access is concentrated in a data access layer, does the schema live there too? Yes, but with a distinction.

**Schema ownership** belongs to infrastructure. Table definitions, column types, relation declarations, and migration files live in one centralized location. This is non-negotiable — migration tooling requires it, foreign keys cross domain boundaries, and centralizing schema ensures there is exactly one place to see all tables.

**Query ownership** belongs to features. Each feature's data access layer (repo, server functions, etc.) writes queries against the shared schema. The feature decides how to join, filter, and project its data. The schema defines what exists; the feature defines how it's accessed.

This split means features don't own their schema — they own their queries. Adding a table means adding it to the centralized schema, then writing queries in the feature that uses it. This feels counterintuitive if you're used to feature-owned migrations, but it's the only model that works when tables have cross-domain foreign keys and relations need to reference each other.

---

## SDK Containment

Third-party SDKs are external dependencies with their own configuration, their own API surfaces, and their own breaking change schedules. Letting them scatter across the codebase creates multiple problems: configuration is duplicated, API key management is decentralized, and SDK version upgrades require touching every file that imports the package.

Two containment strategies, chosen per SDK:

### Wrapped SDKs

Consumer code imports a wrapper module in infrastructure. The wrapper imports the raw package, configures it, and exports a ready-to-use interface. No other file in the codebase may import the raw package.

Use wrapping for SDKs with:
- **Configuration complexity** — API keys, client options, retry policies, webhook verification.
- **Security sensitivity** — Payment processing, auth libraries, email services. API keys must not scatter.
- **API instability** — SDKs with frequent breaking changes. The wrapper absorbs the change; consumers don't update.

The wrapper is not an abstraction layer. It does not hide the SDK behind a generic interface. It configures the SDK and re-exports its interface (or a thin convenience layer over it). The goal is containment, not abstraction.

```typescript
// infrastructure/integrations/payment.ts
import Stripe from "stripe"
import { env } from "@/env.server"

export const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-01-01",
})

// Features import the configured client:
// import { stripe } from "@/infrastructure/integrations/payment"
```

### Layer-restricted SDKs

The raw package is imported directly, but only from allowed directories. No wrapper exists. The enforcement rule restricts which files may import the package.

Use layer restriction for SDKs with:
- **Simple configuration** — The package works out of the box or is configured once at the infrastructure level.
- **Pervasive usage within a layer** — ORMs imported by every repo file, schema libraries imported by every validation file. Wrapping would add indirection without value.
- **Stable APIs** — The package doesn't change often enough to justify an abstraction buffer.

```typescript
// drizzle-orm is layer-restricted: only importable from infrastructure/db/ and repo/ files
// No wrapper needed — drizzle's API is the API

// features/*/repo/items.ts — allowed
import { eq } from "drizzle-orm"
import { items } from "@/infrastructure/db/schema"

// features/*/ui/item-list.tsx — blocked by enforcement
import { eq } from "drizzle-orm"  // VIOLATION
```

### Choosing a strategy

Default to wrapped. Layer-restrict only when wrapping adds genuinely zero value. The cost of an unnecessary wrapper is one small file. The cost of an unwrapped SDK scattering across the codebase is a migration when the SDK changes its API or you need to swap providers.

---

## Error Architecture

### One error class at the server boundary

Features define a single error class with a typed code discriminant. No error hierarchies. No base classes with subclasses. No error-per-use-case.

```typescript
type FeatureErrorCode = "NOT_FOUND" | "FORBIDDEN" | "VALIDATION" | "CONFLICT"

class FeatureError extends Error {
  readonly code: FeatureErrorCode
  constructor(code: FeatureErrorCode, message?: string) {
    super(message ?? code)
    this.code = code
  }
}
```

Controllers switch on `error.code` to determine HTTP status. This is exhaustive — TypeScript catches unhandled codes at compile time. Renaming a code is a type error, not a silent regression.

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

### When to add per-layer errors

Most projects need one error type at the server boundary. Per-layer error types (domain errors, repo errors, controller errors) are justified only when three or more layers need genuine error translation — when the error's meaning changes as it crosses a layer boundary.

If a repo throws "row not found" and the controller translates it to HTTP 404, that's one translation boundary. One error type with a typed code handles it. If a domain throws "invariant violated," a service translates it to "operation failed," and a controller translates it to HTTP 422, that's three layers with genuine translation. That might justify per-layer error types.

Do not create error types speculatively. Start with one. Add per-layer types when you find yourself mapping between error semantics at multiple boundaries.

---

## Test Placement

### Co-location

Tests live next to the code they test. A test for `encryption.ts` lives at `encryption.test.ts` or in an adjacent `__tests__/encryption.test.ts` directory.

Co-location matters because:
- **Discoverability.** An agent looking at a file can immediately find its tests without searching.
- **Ownership.** When the source file moves, its tests move with it. When the source file is deleted, its tests are deleted with it. No orphaned test files.
- **Context.** The test imports the source file with a relative path. The proximity makes the relationship explicit.

### Tests are exempt from boundary rules

Tests need cross-boundary imports for setup and assertions. A test for a controller may need to set up database state, create auth sessions, and assert against infrastructure behavior. Enforcing architectural boundaries on tests would make them either impossible to write or full of awkward dependency injection that exists solely to satisfy the linter.

All per-file and cross-file rules exclude test files from their scope:
- `**/__tests__/**`
- `**/*.test.*`
- `**/*.spec.*`

### The reverse IS enforced

Production code must never import from test files. This is a separate rule that applies in the opposite direction. If production code imports test utilities, those utilities are production code and should live in a shared test infrastructure directory.

Shared test infrastructure — factories, fixtures, helpers used by multiple test files — lives in a dedicated test directory at the project root. This is not governed by architectural boundary rules but is governed by the no-test-imports rule: production code cannot import from it.

### Design for testability

The architecture naturally supports testability through its dependency direction and domain purity:

- **Domain logic is pure.** No mocking needed. Pass inputs, assert outputs.
- **Infrastructure is injectable.** Domain functions accept adapters as parameters. Tests pass test implementations.
- **Server functions are the integration boundary.** Test them with real database connections when practical. Mock external APIs at the HTTP level, not the SDK level.

The testing philosophy is "functional core, imperative shell." Push as much logic as possible into pure functions that can be tested without infrastructure. Let the thin imperative shell (server functions, controllers) handle side effects, and test those with integration tests.

---

## The Cross-Boundary Alias Rule

This is the rule that makes all other import-path-based rules work. It deserves its own section because without it, the entire enforcement system has a bypass vector.

All imports that cross a top-level boundary must use the path alias (e.g., `@/`). Relative imports that traverse into another top-level directory are banned.

```typescript
// From a feature file importing infrastructure:
import { db } from "@/infrastructure/db/client"       // Correct — aliased, caught by DB_ISOLATION
import { db } from "../../../infrastructure/db/client" // Violation — relative, bypasses DB_ISOLATION
```

Every import rule in the enforcement system pattern-matches on aliased import paths. A rule that says "files in `routes/` cannot import `@/infrastructure/db`" works because it can match the string `@/infrastructure/db`. A relative import like `../../infrastructure/db` produces a different string that the rule doesn't match.

The cross-boundary alias rule closes this hole. It ensures that every cross-boundary import uses the format that other rules check. Without it, any rule can be bypassed by using a relative path.

Within a feature or within a subdirectory, relative imports are expected and correct. The alias rule only applies when an import crosses from one top-level directory to another, or from one feature to another.

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

---

## UI Ownership

Components are placed by ownership, not by visual complexity.

| Location | Contents | Restrictions |
|---|---|---|
| Shared UI directory | Generic primitives reusable across features. Buttons, modals, form inputs, layout components. | Must not import features, domains, or infrastructure. |
| Feature UI directory | Feature-specific UI carrying feature semantics. A billing invoice component, a chat message bubble. | May import from its own feature and shared UI. Must not import other features' UI. |
| Transport (routes) | Composes feature and shared UI into pages. | Does not define business UI components. |

### Cross-feature UI is banned

Features must not import each other's UI components. If Feature A needs a component that lives in Feature B's UI directory, there are two options:

1. **Duplicate.** If the component is simple and the features' needs will diverge, copy it. Duplication is cheaper than premature abstraction.
2. **Promote to shared.** If three or more features need the same component without business imports, extract it to the shared UI directory.

The promotion threshold is three, not two. Two features sharing a component is coincidence — their needs may diverge. Three features sharing a component is a pattern worth extracting. This prevents premature promotion that creates shared components tightly coupled to specific features.

---

## File Size Discipline

Large files are architecture smells. A file over 500 lines is doing too many things or operating at too many levels of abstraction. Enforce size limits mechanically.

Use graduated thresholds:
- **Warning threshold** — Signal to the agent that the file is getting large. Split proactively.
- **Failure threshold** — Hard block. The file must be split before the change can land.

The gap between warning and failure gives agents a window to split naturally, as part of the feature work they're already doing. Hitting the hard limit should be rare if the warning is calibrated correctly.

Exclude from size limits:
- Generated files (route trees, GraphQL codegen, etc.)
- Test files (test setup can be verbose; that's fine)
- Scripts (one-off tooling doesn't need the same structure as application code)
- Known-oversized files tracked in a centralized exclusion list with TODOs

The exclusion list must be centralized, not scattered as per-file ignore comments. Every exception is visible in one place. Every exception has a TODO explaining the plan to resolve it.

---

## Evolution and Extension

### Feature graduation

Features start small and grow. The architecture accommodates this through optional layer occupancy — a feature adds layers as it needs them, not before.

A feature graduates from one tier to the next when its current structure becomes insufficient:

- **Minimal to standard:** Multiple entities or operations justify separate files in the data access layer.
- **Standard to complex:** Rich client-side behavior, internal sub-modules, or feature-specific layering rules.

Graduation is driven by need, not by complexity forecasting. Do not create a complex feature structure because the feature "might" need it. Create the structure when the code demands it.

### Migrating an existing codebase

Enforced architecture is most valuable in existing codebases, and existing codebases are the hardest to migrate. The strategy: decompose into atomic phases, each producing a clean repo that passes all rules applicable at that point.

Sequence inside-out. Start with the foundational invariant (database isolation) because it has the fewest dependencies and the highest value. Then feature public API boundaries. Then within-feature layering. Then mechanical relocations (file moves + import rewrites).

Each migration phase pairs rules with the structural changes that make them passable. A rule that requires database access to be concentrated in a data access layer activates in the same phase that moves database imports into that layer. Rules never activate before their supporting structure exists.

No shims. No temporary compatibility layers. No re-exports that exist only to avoid updating imports. Each phase is complete in itself. The codebase passes all activated rules after every phase. An agent can execute any single phase independently without understanding the full migration plan.

Verify after every phase: type checking, test suite, architecture check. If any verification fails, the phase is not complete.

### Extraction signals

Code migrates outward when patterns emerge:

- **Feature logic to domain:** When business logic is complex enough that mixing it with infrastructure makes the code hard to understand, extract it to a pure domain module.
- **Feature UI to shared:** When three or more features need the same UI component without business imports.
- **Feature utility to shared:** When three or more features need the same pure utility.
- **Inline logic to service layer:** When the same orchestration logic appears in multiple controllers within a feature.

The threshold is always three. Two occurrences is coincidence. Three is a pattern. This prevents premature abstraction — the most expensive form of over-engineering, because it constrains every future change to fit an abstraction that was designed without enough information.

### Feature-specific enforcement rules

Complex features may define internal layering rules beyond the base architecture. These rules are:

- Namespaced to the feature (e.g., `PF-EDITOR-01`)
- Documented in the feature's implementation plan
- Implemented in the enforcement script
- Scoped to the feature's directory tree

The base architecture provides the container. Feature-specific rules fill it. This prevents the base rule set from growing linearly with the number of features while still allowing complex features to enforce their own internal structure.

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
