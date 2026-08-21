# Architecture Principles

Why the layers sit where they do, and what may never be traded away. Every other reference handles
specifics. This one handles *why*, and points at the doc or the rule that owns each specific.

---

## The Cost Asymmetry

Convention-based architecture fails when agents write most of the code. One asymmetry drives every
enforcement decision in this catalog:

| Outcome | Cost |
|---|---|
| An agent hits a rule, stops, and asks | Minutes |
| A violation escapes and gets copied across 20 files | Days |
| Structural decay becomes load-bearing: tests depend on it, features assume it | Weeks |

When in doubt, enforce. Every judgment below resolves against this table.

The same asymmetry decides which way to guess on any single boundary. Relaxing a restriction later is
trivial. Tightening one after the violations have been copied as a pattern is a migration. So when a
cell is genuinely undecided, the answer is deny.

---

## The Invariants

These are non-negotiable. Everything else is convention that adapts to the project.

1. **Dependency direction holds.** A lower layer never imports an upper one. No exceptions. —
   [directory-model.md](directory-model.md#layer-hierarchy),
   [lint/policy/import-policy.ts](lint/policy/import-policy.ts)
2. **Database access is concentrated.** Three positions may name the database: `infrastructure/`, a
   feature's `repo/`, and a feature's `controllers/`. —
   [boundary/db-isolation](lint/oxlint/boundary/db-isolation.ts)
3. **Features expose public APIs.** A consumer imports a barrel, never an internal path, so a feature
   that reorganizes internally breaks nobody. — [feature-patterns.md](feature-patterns.md#public-api-barrels),
   [lint/policy/import-policy.ts](lint/policy/import-policy.ts)
4. **SDKs are contained.** Every third-party SDK is either wrapped or layer-restricted. —
   [SDK containment](#sdk-containment)
5. **An import that leaves a unit uses the alias.** — [the alias rule](#the-alias-rule)
6. **Tests are exempt; production is not.** A test may cross any boundary. Production code may never
   import a test file. — [test placement](#test-placement)
7. **The filesystem is the source of truth.** The directory structure plus the import graph fully
   describe the architecture. No metadata layer, no configuration-driven topology.
8. **Rules block.** A rule either fails the build or reports a shape only the author can judge. —
   [what blocks and what does not](#what-blocks-and-what-does-not)

Invariants 1 through 6 have a rule behind them. Invariant 7 has none, and cannot: it is the
constraint on whoever designs the architecture, and it is what rules out a topology manifest as the
answer to any problem below. Invariant 8 has none either — nothing reads a rule's severity back
against its header, so a rule relabelled from `Shows:` to `Makes sure:` leaves the shipped severity
stale and the build green. Both gaps are stated so nobody assumes coverage that is not there.

---

## Foundational Principles

### Mechanical enforcement is knowledge transfer

The enforcement pipeline is the onboarding process.

- **A constraint that no tool enforces does not exist for an agent.** It will be violated. Not
  maliciously, not carelessly. The agent that violates it gets no signal that anything went wrong.
- **The error message is the documentation.** An agent must be able to fix any violation from the
  message alone, without opening a reference doc.
- **The first edit is validated by the same rules as the hundredth.** There is no ramp-up period.

### Types hold a constraint better than a rule does

Before writing a rule, check whether the type system can hold the constraint instead. A typed closed
set beats a lint rule on every axis that matters. It fails at compile time. It needs no exclusion
list. It cannot fall out of sync with what it guards. And it surfaces in autocomplete, so the agent
sees the allowed values while writing rather than the forbidden one after.

That is most of the answer for anything shaped like *the value must come from this closed set*. A
variant prop is a union of token names, not a `string` that a rule then polices.

Types have one structural gap, and it is why the other tiers exist: **a library you did not write
also accepts escape hatches.** A component library may type `gap` as a token union *and* accept a raw
number. A `className` is a string regardless. Write the rule for the leaks only. A rule that
duplicates a constraint the types already hold is maintenance with no coverage.

### Predictable structure enables autonomous navigation

An agent should answer "where does this code live?" from the directory structure alone.

A convention that holds everywhere lets agents navigate on their own. A convention that holds
*mostly* does not, and "mostly" is worse than "never" because it creates false confidence. An agent
that finds a pattern in three files and misses it in a fourth will either reproduce the
inconsistency or "fix" the fourth file. Both are wrong.

Two consequences follow from taking the filesystem as the source of truth. Directory names *are* the
naming convention: if a directory is called `controllers/`, the files in it are controllers, and no
config file is needed to say so. And a layer's name is fixed project-wide: a codebase calling it
`server/` here, `controllers/` there and `api/` in a third place is three architectures pretending to
be one, and an agent will use whichever it saw last.

### Anti-ceremony

Architecture has a tax. Every layer costs readability. Every abstraction costs discoverability. Every
indirection costs debugging time. Those costs are real and they compound.

The goal is not maximum structure. It is the minimum structure that holds the dependency invariants.
Two controls keep architecture from becoming ceremony.

**Layers are optional, and occupancy is enforced.** Layers have a fixed logical order, but physical
presence is optional. A feature with two files does not need four directories. What makes that safe
rather than sloppy is that a layer which exists may not be bypassed, and a layer which does not exist
costs nothing. Never scaffold an empty directory, never create a `.gitkeep`, never create a layer
"because we might need it later." —
[boundary/layer-occupancy](lint/structural/boundary/layer-occupancy.ts)

**A layer function that only forwards a call has not earned its layer.** Do not add `repo/` or
`service/` until controllers use it directory-wide. Restructure or remove the layer rather than
bypassing it. — [health/trampolines](lint/structural/health/trampolines.ts)

### What blocks and what does not

Agents do not distinguish warnings from errors in their behavior. A warning says "this might be
wrong," and an agent treats "might be wrong" the same as "is fine," because neither one blocks
progress. The violation persists, gets committed, gets copied.

So the catalog has exactly two severities, and each rule's own header says which one it takes.

- **`Makes sure:` — the rule blocks.** The shape it reports is wrong, and the fix is mechanical.
- **`Shows:` — the rule reports and does not block.** The shape it reports is *sometimes correct*,
  and only the author knows which case this is. Four oxlint rules carry this label. One structural
  check adds a warning tier in front of its own hard limit, which is the graduated-threshold form of
  the same idea.

A `Shows:` rule is not a rule someone is planning to enforce later. It is a rule whose subject is a
judgment. If a shape is always wrong, it takes `Makes sure:` and blocks.

Three reasons to soften a rule are invalid, and all three are the cost asymmetry misread:

- *"We'll enforce it later."* Violations accumulate. By the time later arrives, enforcement needs a
  migration.
- *"It might have false positives."* A false positive costs minutes. A missed violation costs days.
- *"It's just a best practice."* If it matters enough to check, it matters enough to block. If it
  does not matter enough to block, do not check it.

### Enforce on the import graph, not the runtime graph

What matters is what a file imports, not whether that code runs. A file importing the database client
violates the rule in a dead code path. A dynamic import of a restricted module violates it even if
nothing triggers it.

Static analysis does not need to model runtime control flow. Its guarantees cover the import forms
the shared extractor represents, and an extraction gap that is not written down is a hole nobody
knows about. [lint/structural/import-graph.ts](lint/structural/import-graph.ts) names its own gaps.

### Domain-agnostic enforcement

The architecture defines structural boundaries, not feature behavior. It says that server functions
live in `controllers/` and may not import UI. It does not say how one feature structures its mutation
logic. Feature-internal conventions belong in feature implementation plans. This is what keeps the
rule set from growing with the number of features.

---

## The Layer Model

**Layers are defined by responsibility, not by directory name.** Every project adapts the names. What
does not change is the direction between them and the separation of concerns.

Three consequences are worth stating once, because each one is a decision a project makes rather than
a rule it inherits.

- **Transport is the thinnest layer, and it has to stay thin** because it is the most
  framework-coupled code in the system. A framework migration rewrites it entirely, and that
  migration is mechanical only if the layer holds nothing but calls into features.
- **The feature is the unit of ownership**, not the technical layer. The owner is "the billing
  feature," never "the server functions layer." A feature owns everything needed to deliver one piece
  of product functionality, in a vertical slice.
- **Infrastructure faces downward only.** If an adapter needs to know about a feature, invert the
  dependency and let the feature pass what it needs.

What each position on disk may import, and the argument for each:
[directory-model.md](directory-model.md#layer-hierarchy) for the shape, and the rule's own message
for the argument. Every denial prints a paragraph on why that position works the way it does, with
this project's directory names filled in, so this doc does not carry a second copy.

---

## Server Functions as the DB Boundary

The most important boundary in a full-stack application. Server functions — or whatever the stack
calls its data access boundary — are the single point of database access, input validation and auth
enforcement. No client-side code imports the database.

Database imports scattered across routes, UI and utilities leave a codebase with no API surface. A
schema change means auditing every file that might touch it. Auth checks get duplicated or forgotten.
Validation is copy-pasted or absent. Concentrating access gives one place to enforce auth, one place
to validate input, one interface that absorbs schema changes, and a server/client split the bundler
can see from the directory alone.

### Why SSR makes this urgent

SSR blurs the server/client line: the same code runs on the server during render and on the client
during hydration. A component that imports the database client works in development and fails only
when the client bundler tries to ship a database driver. That feedback loop is long enough for the
pattern to spread first, and the hydration variant is worse, because the bundler catches nothing.
Only a rule that stops the import existing catches those, which is why framework protection and the
architecture rules deliberately overlap here.
[server-client-boundaries.md](server-client-boundaries.md#two-boundaries) says which mechanism is
primary for what.

### Schema ownership versus query ownership

**Schema belongs to infrastructure.** Table definitions, column types, relations and migrations sit
in one place. This is non-negotiable: migration tooling requires it, foreign keys cross domain
boundaries, and one location is the only way to see every table at once.

**Queries belong to features.** Each feature's data access layer writes against the shared schema and
decides how to join, filter and project.

So a feature owns its queries, not its tables. Adding a table means adding it centrally, then
querying it from the feature that needs it. This reads backwards if you are used to feature-owned
migrations, and it is the only model that survives a foreign key across two domains.

The same logic governs another feature's data. Any repo *can* import any table, but a feature that
needs another feature's data calls that feature's API instead. The owning feature controls how its
data is exposed, including auth, validation and query shape — and it controls *who may consume it*
too: [api/feature-visibility](lint/structural/api/feature-visibility.ts) requires the importee to
name each permitted consumer, with a written reason, before a cross-feature import resolves.

---

## SDK Containment

An SDK left free to scatter duplicates its configuration, decentralizes its keys, and turns a
version upgrade into an edit of every file that imports it. So every SDK is contained one of two
ways.

- **Wrapped.** The raw import is banned everywhere except the modules named as its owners, which
  configure the SDK and re-export its interface. The goal is containment, not abstraction — the
  wrapper does not hide the SDK behind a generic API. `boundary/sdk-containment` enforces this, one
  row per package, each row naming its owner modules and the reason.
- **Layer-restricted.** The raw import is allowed from a whole layer, with no wrapper. This fits an
  SDK configured once and used pervasively inside one layer: an ORM every repo module imports.

Default to wrapping. Layer-restrict only when a wrapper would forward calls and nothing else. An
unnecessary wrapper costs one small file. An unwrapped SDK scattered across the codebase costs a
migration when its API changes or the provider is swapped.

**Know what layer restriction costs.** There is no general mechanism for it. `sdk-containment` is
keyed by package and owner module, never by layer, so a package left off its list is simply
unconstrained — nothing detects that state. The one layer restriction the catalog ships is the
database, which `boundary/db-isolation` fences by position rather than by package. Choosing
layer-restricted for anything else means choosing no enforcement, and it is worth writing down as
such in the project's plan.

Which packages get a row, which do not, and why an ORM is deliberately absent:
[lint/policy/package-owners.ts](lint/policy/package-owners.ts). That file also states the negative
space, which is the part to carry into the project's own notes: **a package with no row is
unconstrained, and nothing detects that state.** Adding an SDK means adding the row.

The procedure for adding one is `docs/architecture/how-to/new-infra-adapter.md`, per
[documentation-model.md](documentation-model.md).

---

## Error Architecture

A feature defines one error class with a typed code discriminant. No hierarchies, no base classes, no
error-per-use-case. Controllers switch on `error.code` to pick an HTTP status, which TypeScript makes
exhaustive: renaming a code becomes a type error rather than a silent regression.

Never switch on `error.message`. Message strings are for humans reading logs. Code that branches on
one is a typo away from a silent bug.

Do not create error types speculatively. Start with one, and add per-layer types when you find
yourself mapping between error meanings at more than one boundary. That is a configurable choice —
see [directory-model.md](directory-model.md#choice-4-error-architecture).

---

## Test Placement

**Tests live next to the code they test.** Co-location buys three things: an agent finds a file's
tests without searching, tests move and die with their source instead of orphaning, and the relative
import makes the relationship explicit.

**Tests are exempt from boundary rules.** A controller test may need to set up database state, create
auth sessions and assert against infrastructure. Enforcing boundaries there makes tests either
impossible to write or full of dependency injection that exists only to satisfy the linter. The
exemption is stated once for the whole catalog, never per rule — see *Rule Design Principles* in
[enforcement-implementation.md](enforcement-implementation.md).

**The reverse is enforced.** Production code may not import a test file, and it may not import the
shared test directory either. A helper both tests and production need is production code: move it to
`shared/` or to the production directory that owns it. —
[boundary/no-test-imports](lint/oxlint/boundary/no-test-imports.ts)

**Design for testability: functional core, imperative shell.** Pure domain logic needs no mocking,
infrastructure is injectable, and server functions are the integration boundary — test those against
a real database where practical, and mock external APIs at the HTTP level rather than the SDK level.

---

## The Alias Rule

This is what makes every other import-path rule work. Without it the enforcement system has a bypass
vector.

Every import rule matches on the aliased path. "A file in `routes/` may not import
`@/infrastructure/db`" works because the rule can match that string — and `../../infrastructure/db`
names the same module with a string the rule never sees. So every import that leaves the unit it is
written in uses the alias, and a relative import that lands in another unit is denied. Inside one
unit, relative imports are correct: they cross nothing.

**A unit is finer than a top-level directory.** `shared/ui/` and the rest of `shared/` are one
boundary and two units, so a primitive reaching `../lib/tokens` is a crossing even though both ends
sit under `shared/`. Reading the first path segment as the boundary is exactly what let that edge go
ungoverned in the rules this replaced.

Sequence this one first in a migration. Both halves are one rule:
[the structural half](lint/structural/boundary/import-policy.ts) resolves relative edges,
[the oxlint half](lint/oxlint/boundary/import-policy.ts) reads aliased ones, and both ask
[the same table](lint/policy/import-policy.ts).

---

## Growing the Architecture

**A feature graduates on need, not forecast.** It adds a layer when the code demands it, never
because it might. Tiers and their triggers:
[feature-patterns.md](feature-patterns.md#graduation-triggers).

**Code moves outward when a pattern emerges, and the number is three.** Two occurrences is
coincidence; three is a pattern. It applies uniformly: UI to `shared/ui/`, a utility to `shared/`,
business logic to a domain, repeated controller orchestration down into a service. Nothing enforces
the number, so it is the reviewer's to hold — and holding it is what prevents premature abstraction,
which is the most expensive form of over-engineering. It constrains every future change to fit a
shape designed before anyone knew enough.

**Cross-feature UI is banned.** When feature A needs something in feature B's `ui/`, either
**duplicate it** — cheaper than premature abstraction when the two features' needs will diverge — or
**promote it to `shared/ui/`**, once three features need it and it carries no business imports.

**A large file is an architecture smell.** A file past a few hundred lines is doing too many things
or working at too many levels of abstraction. There is no exception list, and the check has no field
for one: a per-file pass makes the limit advisory, one entry per commit that would have failed. A
project whose files are legitimately longer raises the threshold, visibly, in one place. —
[health/file-size](lint/structural/health/file-size.ts)

**A migration is decomposed into phases**, each one clearing a class of finding. No shims, no
compatibility layers, no re-exports that exist only to avoid updating imports. Sequencing:
[migration-patterns.md](migration-patterns.md).

**A complex feature may define its own rules.** The base architecture provides the container; the
feature fills it. That split is what keeps the base rule set from growing with the number of
features. What that costs to set up: [feature-patterns.md](feature-patterns.md#feature-scoped-rules).
