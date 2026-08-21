# Rule Catalog

Every enforcement rule in one tree, split by **tier** first and **tag** second. Read this file for
the tag map, then a tier's tag `overview.md` for what its rules hold, then the rule itself to adapt
it. Adapting is the only decision on offer: the catalog is taken whole. The per-tag counts below are
derived from the tree; no total is stated in prose, because a total goes stale on the next add and
nothing checks it.

Each rule documents itself in its own file's header, in both tiers: what it buys, what edit would
break it, what it deliberately does not cover. No adaptation section, because no rule is adapted in
its own file — an oxlint rule reads its layout from
[policy/declared-trees.ts](policy/declared-trees.ts), and a structural check's keys are in
[structural/config.ts](structural/config.ts).

```
policy/       runtime-neutral tables both tiers read
oxlint/       the per-file tier
structural/   the whole-tree tier
```

## Why three directories

**`policy/`** is runtime-neutral: no Node APIs, no oxlint or ESTree types, and no import from either
tier. Nothing enforces that — it is a convention held by review. It sits below both, so one edge cannot reach two verdicts depending on how it was
spelled. It holds the layout vocabulary, the source × target import table, and the package ownership
rows, each read by an adapter on each side. See [policy/overview.md](policy/overview.md).

**`oxlint/`** is handed one file at a time and sees its syntax. It catches what is visible in a single
source text: a specifier, a JSX prop, a hook call.

**`structural/`** is handed the resolved import graph, the filesystem, and a TypeScript program. It
catches what no single file can show: where a relative specifier lands, whether a feature cycles,
whether a barrel exports what it claims, what an annotation actually resolves to.

Both run under Node 24 — see [setup/with-real-node.sh](../setup/with-real-node.sh) for why the
launcher is not optional in either.

The split is a fact about what each tier can *see*. A rule belongs to whichever tier can answer its
question, and a rule whose question needs both is a rule whose policy belongs in `policy/`, read by an
adapter on each side. The tag says what a rule is *about*; the tier says what it can see.

## The tags

| Tag | oxlint | structural | Governs |
|---|---|---|---|
| **boundary** | [8](oxlint/boundary/overview.md) | [2](structural/boundary/overview.md) | What may import what. The only constraint that holds when nobody is reading |
| **types** | [5](oxlint/types/overview.md) | [7](structural/types/overview.md) | Whether a type declaration says anything: untyped bags, `unknown` contracts, unjustified `as` |
| **placement** | [7](oxlint/placement/overview.md) | [2](structural/placement/overview.md) | Where code may *live*, so the paths other rules match are the paths code is in |
| **style** | [6](oxlint/style/overview.md) | [3](structural/style/overview.md) | Design-system adherence: tokens, primitives, no raw values |
| **effect** | [6](oxlint/effect/overview.md) | — | Effect-TS policy bans — the syntactic residue after @effect/language-service, which owns everything type-aware |
| **react** | [5](oxlint/react/overview.md) | — | Component-level smells that survive review because each one looks reasonable |
| **api** | [2](oxlint/api/overview.md) | [2](structural/api/overview.md) | How deep a permitted import may reach. Barrels and public surface |
| **health** | [1](oxlint/health/overview.md) | [3](structural/health/overview.md) | Size and shape signals. Nothing here is a correctness defect |
| **naming** | [1](oxlint/naming/overview.md) | [2](structural/naming/overview.md) | Keeping the public surface findable by plain text search |
| **graph** | — | [2](structural/graph/overview.md) | Questions no single file can answer: cycles, coupling |
| **testing** | [1](oxlint/testing/overview.md) | — | Tests that pass while the thing they cover is broken |

`placement/` and `boundary/` are the pair most often confused. `placement/` is where code may live.
`boundary/` is what code may import.

`structural/module-scanning.ts`, `module-resolution.ts`, `import-graph.ts` and `type-checker.ts` are
**not** rules and are in no tag. They are the substrates every check consumes — which specifiers a
file names, where each one lands, the graph over both, and what a declaration means — and none of
them is registered.

## What each rule's subject is

Every rule here is adopted. This table says which part of the tree owns each rule's subject, so you
know what a rule is pointed at and what it is waiting for. A row this project has nothing matching is
a rule staying silent until it does, and that silence is the rule doing its job: the day the tree
grows a `domains/` directory, the fence is already standing.

Audit findings tell you which rows are live today, and so what the rollout has to sweep. They do not
decide which rules ship.

| If the project has... | ...these rules have a subject in it |
|---|---|
| A database layer | `boundary/db-isolation`, `placement/schema-placement`, `placement/no-raw-result` |
| A `domains/` directory | `graph/domain-cycles`. Domain purity and how deep an import may reach into a domain are columns in the import table, not rules to add |
| More than one feature | `graph/feature-deps` and `api/feature-visibility`. The public-API restriction is a row in the import table |
| SSR or bundle splitting | `api/barrel-direction`, `api/barrel-purity`, `api/server-import-context`, `boundary/client-server-infra` |
| `createServerFn` or `createMiddleware` | `placement/server-fn-placement` and `placement/server-fn-validation` for server functions; `placement/no-deprecated-input-validator` and `placement/no-plain-export-in-server-fn-module` for both |
| Intra-feature layers | `placement/layer-direction`, `boundary/layer-occupancy`, `boundary/server-no-upward`, `health/trampolines` |
| A routes layer | `boundary/route-thinness` |
| React UI | Every `react/` rule, including `no-async-effect` if the project uses TanStack Query or similar |
| A design system or component library | `style/no-raw-primitives`, `style/no-inline-color`, `style/no-inline-font-size`, `style/token-equality`, `style/shadow-source` |
| Stylesheets (`.css`, CSS modules) | `style/css-tokens` |
| Utility CSS (Tailwind or similar) | `style/no-arbitrary-class-values` |
| A stylesheet layer that inline styles would bypass (Unistyles, StyleX, vanilla-extract) | `style/no-inline-style-prop` |
| Wrapped UI-library components | `style/vendor-component-containment` |
| External SDK integrations | `boundary/sdk-containment` |
| Public barrels | `naming/barrel-discoverability` |
| Co-located tests | `naming/test-file-mirror`, and `testing/no-module-mocking` once agents write most of them — expect a migration there, not a lint fix |
| A path this project has already moved away from | `placement/deprecated-paths` |
| Standing docs agents read on every task | `health/doc-budgets` — word ceilings that ratchet down, so the docs enforcement leans on stay short enough to be read |
| Agents writing most of the code | The `types/` assertion trio — `require-safety-comment`, `no-chained-type-assertions`, `no-widen-then-assert` — plus `types/no-type-argument-assertion`, the spelling of the same claim (`api.get<User>(url)`) that all three miss because it never writes `as`. Taking a subset leaves the hole the others close; the trio spans both tiers |
| Effect | Every `effect/` rule. Adopt `@effect/language-service` first; the `effect/` overview explains why that is step zero and these are only what it leaves on the table |
| A boundary where external data enters (API, queue, file) | `types/no-broad-parameters`, `types/no-unknown-returns`, `types/no-unknown-type-aliases`. These push `unknown` back to the parse site instead of letting it spread inward |
| TypeScript 4.9+ | `types/no-known-value-widening`. The fix it names, `satisfies`, does not exist before that |
| Any TypeScript project | `boundary/import-policy` in both tiers — two halves of one rule — plus `boundary/ambient-globals`, `boundary/no-test-imports`, `placement/topology`, `naming/no-vacant-symbol-names`, `health/file-size`, `health/no-nested-ternary`, `types/no-opaque-record`, `types/no-reflect-access` |

Two rules appear in no row, because their subject is any TypeScript file rather than a structure a
project either has or lacks: `types/no-runtime-typeof` and `types/no-conditional-empty-object-spread`.
Both ship on, the second at `warn`.

`types` is **the one tag where the tier split changes what a project gets**: seven of its twelve
rules need a checker and run in the structural tier, so taking only the oxlint half leaves the tag
covering assertions and nothing else — and no oxlint run says so. Those seven also want what no other
check does, a `tsconfig` named on each declared tree. Both `types` overviews carry the detail, and
what each tier rejects that is sometimes correct.

## Adopting the catalog

The order of the copy, the dev dependencies and the config files are Phase 4 of
[SKILL.md](../../SKILL.md). Four facts about the catalog's own shape belong here.

**The project mirrors this tree.** A `lint/` directory at the repo root holds `policy/`, `oxlint/`
and `structural/`, so copying a rule is copying a path and a rule's tier stays visible.

**`lint/policy/` goes first, whole, before either tier.** It is four modules and a spec, and the only
one that changes is `declared-trees.ts`. Both tiers import it, so a declaration that lands there
reaches every rule at the same moment. Copy the spec too: it proves the tables still mean what they
meant after the repoint.

**A tree left off that list is governed by almost nothing, with no diagnostic saying so.** Every
tree-scoped rule in both tiers is silent there. The three that still run, and what each walks
instead, are named in [enforcement-implementation.md](../enforcement-implementation.md).

**No rule takes a path pattern as configuration.** Every `arch/` rule but one reads `lint/policy/`
for where things live and what they are called, so declaring the trees is the whole adaptation of the
oxlint tier. The exception, `testing/no-module-mocking`, reads no layout at all.

Two rules hold a hand-written list in their own source, and neither is a knob:
`boundary/client-server-infra`'s two client-safe modules — widened by editing the rule, deliberately,
so config cannot — and `placement/deprecated-paths`'s moved-away-from patterns, which are that rule's
whole subject. Nothing else in either tier holds a list of paths.

Structural checks are **copied, not adapted**: adopting one means writing config, never
reimplementing an algorithm. Typed shapes and defaults for the checks that take config are in
[structural/config.ts](structural/config.ts); the rest read only the tree. Six answer *where an
import lands* rather than *how it is spelled*, so the import graph is built before its consumers;
seven ask what a declaration means, so a TypeScript program is built for their trees — lazily, so a
project running none of them never pays for one.

## What is verified before it reaches you

Every rule in both tiers is proved against three kinds of case — the obvious violation, the
adversarial spelling, and the legal neighbour that must stay silent. What each kind must assert, and
what the runner checks around the specs, is *Rule Specs* in
[enforcement-implementation.md](../enforcement-implementation.md).

The two tiers are proved differently, because they read differently.

- **oxlint rules** are per-file, so each runs through oxlint's `RuleTester` against inline sources.
  The specs ship beside the rules. `npm run check:rules`.
- **Structural checks** scan declared trees, so their cases are real files in one shared tree under
  `harness/structural-fixtures/tree/`, pointed at by one config object — which doubles as the worked
  example of adopting the tier. That tree carries a second, **undeclared** package. The harness
  proves it produces nothing while undeclared, produces findings the moment it is declared, and is
  read with its own vocabulary rather than the first tree's — with a positive control, so the silent
  half cannot pass vacuously. Findings are compared as a multiset with severity, and every registered
  check must have expectations, so a check that is deleted or stubbed fails rather than passing on
  zero findings. `npm run check:structural`.

**What that does not prove, and it is the limit worth knowing before you trust a green run.**
`RuleTester` is not the linter. It runs the same rule over the same source without building the same
environment, and in particular it populates **no global scope**. A rule that reasons about globals
gets a different answer there than in production, and its specs are written in the host where that
answer happens to be the expected one. `types/no-reflect-access` shipped that way: registered,
documented, typechecked, every case green, and it reported nothing when oxlint ran it.

One rule is proved through a real `oxlint` run on every check. The rest were each linted through the
real CLI once, by hand, and nothing re-runs that. Run your adapted rule over a file that should fail
before you trust it.

**Whether a rule survives adaptation is covered for neither tier.** Renaming a directory, moving a
source root or a threshold is unverified work: the catalog's specs are written against the
recommended vocabulary, not yours. Write the project's own specs in the same change. What is *not* on
the table is repointing a rule at a different path or excluding a tree from one.

The harness does not ship with the skill directory. It lives in `harness/`, beside `skills/` in the
skill's source repository. The rules and their config do ship, which is the point.
