# Rule Catalog

Every enforcement rule in one tree, split by **tier** first and **tag** second. Read this file for
the tag map, a tier's tag `overview.md` for what the rules in it hold, then the rule itself to
adapt it. Adapting is the only decision on offer here — the catalog is taken whole.
The per-tag counts in the table below are the only ones stated anywhere — a total in prose goes
stale on the next add or delete and nothing checks it.

Each rule carries its documentation in the header of its own file, in both tiers. The header names
what the rule buys, and then guards the reader against a wrong edit. An oxlint rule carries its
*Adapt* section in that header too; the keys a structural check reads are in
[structural/config.ts](structural/config.ts).

```
policy/       runtime-neutral tables both tiers read
oxlint/       the per-file tier
structural/   the whole-tree tier
```

## Why three directories

**`policy/`** is runtime-neutral: no Node APIs, no Bun APIs, no oxlint ESTree types, and no import
from either tier. It sits below both so one edge cannot reach two verdicts depending on how it was
spelled. It holds the import policy — the layout vocabulary, the source × target table, and the
package ownership rows — each read by an adapter on each side. See
[policy/overview.md](policy/overview.md).

**`oxlint/`** is handed one file at a time and sees its syntax. It catches what is visible in a
single source text: a specifier, a JSX prop, a hook call. Its specs run under real Node — oxlint's
`RuleTester` refuses Bun by name.

**`structural/`** is handed the resolved import graph and the filesystem. It catches what no single
file can show: where a relative specifier actually lands, whether a feature cycles, whether a
barrel exports what it claims. It runs under Bun.

The split is a fact about what each tier can *see*, so a rule belongs to whichever one can answer
its question — and a rule whose question needs both is a rule whose policy belongs in `policy/`,
read by an adapter on each side. The tag below the tier says what a rule is *about*; the tier above
it says what the rule can see.

## The tags

| Tag | oxlint | structural | Governs |
|---|---|---|---|
| **boundary** | [8](oxlint/boundary/overview.md) | [2](structural/boundary/overview.md) | What may import what. The only constraint that holds when nobody is reading |
| **types** | [12](oxlint/types/overview.md) | — | Whether a type declaration says anything — untyped bags, `unknown` contracts, unjustified `as` |
| **placement** | [7](oxlint/placement/overview.md) | [2](structural/placement/overview.md) | Where code may *live*, so the paths other rules match are the paths code is in |
| **style** | [6](oxlint/style/overview.md) | [3](structural/style/overview.md) | Design-system adherence — tokens, primitives, no raw values |
| **api** | [2](oxlint/api/overview.md) | [2](structural/api/overview.md) | How deep a permitted import may reach. Barrels and public surface |
| **react** | [6](oxlint/react/overview.md) | — | Component-level smells that survive review because each looks reasonable |
| **effect** | [6](oxlint/effect/overview.md) | — | Effect-TS policy bans — the syntactic residue after @effect/language-service, which owns everything type-aware |
| **health** | [1](oxlint/health/overview.md) | [3](structural/health/overview.md) | Size and shape signals. Nothing here is a correctness defect |
| **naming** | [1](oxlint/naming/overview.md) | [2](structural/naming/overview.md) | Keeping the public surface findable by plain text search |
| **graph** | — | [2](structural/graph/overview.md) | Questions no single file can answer — cycles, coupling. Build the import graph first |
| **testing** | [1](oxlint/testing/overview.md) | — | Tests that pass while the thing they cover is broken |

`placement/` and `boundary/` are the pair most often confused: `placement/` is where code may live,
`boundary/` is what code may import.

## What each rule's subject is

Every rule here is adopted. This table is the other question — which part of the tree owns each
rule's subject, so you know what a rule is pointed at and what it is waiting for. A row this
project has nothing matching is a rule that stays silent until it does, and that silence is the
rule doing its job: the day the tree grows a `domains/` directory or a first `createServerFn`,
the fence is already standing.

Audit findings tell you which rows are live TODAY, and so which violations the rollout has to
sweep. They do not decide which rules ship.

| If the project has... | ...these rules have a subject in it |
|---|---|
| Database layer | `boundary/db-isolation`, `placement/schema-placement`, `placement/no-raw-result` |
| `domains/` directory | `graph/domain-cycles` — both domain purity and how deep an import may reach into a domain are columns in `boundary/import-policy`, not rules to add |
| Multiple features | `graph/feature-deps` — the public-API restriction is a row in `boundary/import-policy` |
| Multiple features **and** agents writing most of the code | `api/feature-visibility` — pair-wise opt-in on top of the above |
| SSR / bundle splitting | `api/barrel-direction`, `api/barrel-purity`, `api/server-import-context`, `boundary/client-server-infra` |
| `createServerFn` or `createMiddleware` usage | `placement/server-fn-placement` and `placement/server-fn-validation` for server functions; `placement/no-deprecated-input-validator` and `placement/no-plain-export-in-server-fn-module` for both |
| Intra-feature layers | `graph/import-graph`, `placement/layer-direction`, `boundary/layer-occupancy`, `boundary/server-no-upward` |
| React UI | All `react/` rules (including `no-async-effect` if using TanStack Query or similar) |
| A design system / component library | `style/no-raw-primitives`, `style/no-inline-color`, `style/no-inline-font-size`, `style/token-equality`, `style/shadow-source` |
| Stylesheets (`.css`, CSS modules) | `style/css-tokens` |
| Utility CSS (Tailwind or similar) | `style/no-arbitrary-class-values` |
| A stylesheet layer inline styles would bypass (Unistyles, StyleX, vanilla-extract) | `style/no-inline-style-prop` |
| Wrapped UI-library components | `style/vendor-component-containment` |
| External SDK integrations | `boundary/sdk-containment` |
| Public barrels (two-barrel API) | `naming/barrel-discoverability` |
| Co-located tests | `naming/test-file-mirror` |
| Co-located tests **and** agents writing most of them | `testing/no-module-mocking` — expect a migration, not a lint fix |
| Standing docs agents read on every task (CLAUDE.md, `docs/architecture/`) | `health/doc-budgets` — word ceilings that ratchet down, so the docs enforcement leans on stay short enough to be read |
| Agents writing most of the code | The `types/` assertion trio: `require-safety-comment`, `no-chained-type-assertions`, `no-widen-then-assert` — plus `types/no-type-argument-assertion`, the spelling of the same claim (`api.get<User>(url)`) that all three miss because it never writes `as`. Taking a subset leaves the hole the others close |
| Uses Effect | All `effect/` rules — but adopt `@effect/language-service` first; the `effect/` overview explains why it is step zero and these are only what it leaves on the table |
| A boundary where external data enters (API, queue, file) | `types/no-broad-parameters`, `types/no-unknown-returns`, `types/no-unknown-type-aliases` — these push `unknown` back to the parse site instead of letting it spread inward |
| TypeScript 4.9+ | `types/no-known-value-widening` — the fix it names (`satisfies`) does not exist before that |
| Any TypeScript project | `graph/import-graph`, `boundary/import-policy` — both tiers, they are two halves of one rule — `boundary/ambient-globals`, `boundary/no-test-imports`, `placement/topology`, `health/file-size`, `health/no-nested-ternary`, `types/no-opaque-record`, `types/no-reflect-access` |

`types/no-runtime-typeof` and `types/no-conditional-empty-object-spread` appear in no row
because their subject is any TypeScript file, not a structure a project either has or lacks.
Both ship on — `no-conditional-empty-object-spread` at `warn`, which is what its `Shows:` header
buys. Read [oxlint/types/overview.md](oxlint/types/overview.md) for what each rejects that is
sometimes correct.

## Adopting a rule

The consuming project mirrors this tree: a `lint/` directory at the repo root holding `policy/`,
`oxlint/` and `structural/`. Copying a rule then means copying a path, and a rule's tier is as
visible in the project as it is here.

1. **`lint/policy/` goes first, whole and before either tier.** It is four modules and a spec, and
   the only one that changes is `declared-trees.ts` — the list of source roots this project adopts
   the catalog for, each carrying the vocabulary its directories are spelled in. Both tiers import
   it, so a declaration that lands here reaches every rule that reads it at the same moment. Copy
   the spec too: it is what proves the tables still mean what they meant after the repoint.

   **A tree left off that list is governed by almost nothing**, with no diagnostic saying so:
   every tree-scoped rule in both tiers is silent there. The three that still run are
   `testing/no-module-mocking`, which is enabled globally because its subject is a test file, and
   the project-scoped `health/file-size` and `health/doc-budgets`, which walk their own configured
   roots. Declaring the trees is the adoption decision; everything below is mechanics.
2. **oxlint rules** go into `lint/oxlint/<tag>/`, are registered in `lint/oxlint/plugin.ts`, and are
   switched on in `.oxlintrc.json`. Each rule's spec (`<name>.test.ts`) is copied beside it — it is
   part of the rule, not an optional extra. **None of them is repointed at a path.** Every `arch/`
   rule reads `lint/policy/` for where things live and what they are called, so declaring the trees
   is its adaptation — which is why an *Adapt* section that says "nothing here" is the norm rather
   than the exception. The named constants a rule does hoist are enumerable vocabulary: names,
   numbers, explicit rows. A rule that took a path regex or a glob would be handing the adopter an
   off-switch. `.oxlintrc.json` scopes every `arch/` rule to the declared roots,
   one `<root>/**` glob each, and the rule harness fails the build when that list and
   `declared-trees.ts` disagree.
3. **Structural checks** go into `lint/structural/<tag>/`, along with the substrate that sits at
   `lint/structural/`: `check-substrate.ts`, `import-graph.ts`, `config.ts`, `registry.ts` and the orchestrator.
   Each exports a check that **returns findings** and declares its `scope`; the orchestrator owns
   reporting and the exit code. Tree-scoped checks run once per declared tree against that tree's
   own graph and vocabulary; `health/file-size` and `health/doc-budgets` are project-scoped, and
   that pair is the whole of the exception. These are **copied, not adapted** — adopting one means
   writing config, not reimplementing an algorithm. See
   [structural/config.ts](structural/config.ts) for the shape and for the keys each check reads.
4. **Build [graph/import-graph](structural/import-graph.ts) before its consumers.** Most
   structural checks answer *where an import lands* rather than *how it is spelled*, and they are
   the ones that break silently when they don't. This is the **fourth** reason a check cannot live
   in the per-file tier, alongside cross-file analysis, filesystem awareness, and counting across a
   file set: the answer is a function of the importing file's location, not of the import string.
5. **Every rule ships with its specs**, including one adversarial case — see *Rule Specs* in
   [enforcement-implementation.md](../enforcement-implementation.md).

Each tier is its own tsconfig program, because they run under different runtimes. Copy
[../setup/oxlint.tsconfig.json](../setup/oxlint.tsconfig.json) and
[../setup/structural.tsconfig.json](../setup/structural.tsconfig.json); both explain themselves.

## What is verified before it reaches you

Every rule here, both tiers, is runnable code proved in this repo's CI against three kinds of case:
the **obvious** violation, the **adversarial** spelling that beats a naive implementation, and the
**legal** neighbour that must stay silent. The two tiers are proved differently because they read
differently:

- **oxlint** rules are per-file, so each is exercised through oxlint's `RuleTester` against inline
  sources. The specs ship *beside* the rules, so a project stealing a rule steals its tests in the
  same copy. `bun run check:rules`.
- **Structural** checks scan declared trees rather than being handed a file, so the cases are real
  files in one shared tree under `harness/structural-fixtures/tree/`, and the checks are pointed at it
  wholesale by one config object — which doubles as the worked example of adopting the tier. That
  tree also carries a second, UNDECLARED package: the harness proves it produces nothing until it is
  declared, produces findings the moment it is, and is read with its own vocabulary rather than the
  first tree's.
  Findings are compared as a **multiset with severity** against declared expectations, and every
  registered check must have expectations, so a check that is deleted or stubbed fails rather than
  passing on zero findings. `bun run check:structural`.

**What that does NOT prove, and it is the limit worth knowing before you trust a green run.**
`RuleTester` is not the linter: it runs the same rule over the same source without building the
same environment, and in particular it populates **no global scope**. So a rule that reasons about
globals gets a different answer there than in production, and its specs are written in the host
where the answer happens to be the expected one. `types/no-reflect-access` shipped that way —
registered, documented, typechecked, fifteen green cases, and it reported nothing when oxlint ran
it. One rule is additionally proved through a real `oxlint` run today; the rest are not. Run your
adapted rule over a file that should fail before you trust it, and treat that as the check rather
than a formality.

The harness does not ship with the skill directory; it lives in `harness/` beside `skills/` in the
skill's source repository. The rules and their config do ship, which is the point.

**What the harness does not cover for either tier: whether a rule survives adaptation.** Renaming a
directory, moving a source root, or moving a threshold is unverified work — the catalog's specs are
written against the recommended vocabulary, not against yours. Write the project's own specs at the
same time as the adaptation, not after. What is *not* on the table is repointing a rule at a
different path or excluding a tree from one: no rule takes a pattern, and `.oxlintrc.json` is pinned
against `declared-trees.ts`.
