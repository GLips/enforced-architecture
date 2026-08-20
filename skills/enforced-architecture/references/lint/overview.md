# Rule Catalog

70 enforcement rules in one tree, split by **tier** first and **tag** second. Read this file to
choose tags, a tier's tag `overview.md` to choose rules within it, and a rule's own template —
which carries its documentation, *Adapt* section, and implementation — to adapt it.

```
policy/       runtime-neutral tables both tiers read
oxlint/       the per-file tier
structural/   the whole-tree tier
```

## Why three directories

**`policy/`** is runtime-neutral: no Node APIs, no Bun APIs, no oxlint ESTree types, and no import
from either tier. It sits below both so one edge cannot reach two verdicts depending on how it was
spelled. See [policy/README.md](policy/README.md) for the contract it holds itself to.

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
| **boundary** | [10](oxlint/boundary/overview.md) | [2](structural/boundary/overview.md) | What may import what. The only constraint that holds when nobody is reading |
| **types** | [12](oxlint/types/overview.md) | — | Whether a type declaration says anything — untyped bags, `unknown` contracts, unjustified `as` |
| **placement** | [7](oxlint/placement/overview.md) | [2](structural/placement/overview.md) | Where code may *live*, so the paths other rules match are the paths code is in |
| **style** | [6](oxlint/style/overview.md) | [3](structural/style/overview.md) | Design-system adherence — tokens, primitives, no raw values |
| **api** | [4](oxlint/api/overview.md) | [2](structural/api/overview.md) | How deep a permitted import may reach. Barrels and public surface |
| **react** | [6](oxlint/react/overview.md) | — | Component-level smells that survive review because each looks reasonable |
| **effect** | [6](oxlint/effect/overview.md) | — | Effect-TS policy bans — the syntactic residue after @effect/language-service, which owns everything type-aware |
| **health** | [1](oxlint/health/overview.md) | [3](structural/health/overview.md) | Size and shape signals. Nothing here is a correctness defect |
| **naming** | [1](oxlint/naming/overview.md) | [2](structural/naming/overview.md) | Keeping the public surface findable by plain text search |
| **graph** | — | [2](structural/graph/overview.md) | Questions no single file can answer — cycles, coupling. Build the import graph first |
| **testing** | [1](oxlint/testing/overview.md) | — | Tests that pass while the thing they cover is broken |

`placement/` and `boundary/` are the pair most often confused: `placement/` is where code may live,
`boundary/` is what code may import.

## Selecting rules

Not every project needs every rule. Use audit findings to guide selection.

| If the project has... | Include these rules |
|---|---|
| Database layer | `boundary/db-isolation`, `placement/schema-placement`, `placement/no-raw-result` |
| `domains/` directory | `boundary/domain-purity`, `api/domain-public-api`, `graph/domain-cycles` |
| Multiple features | `api/feature-public-api`, `graph/feature-deps` |
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
| Any TypeScript project | `graph/import-graph`, `boundary/cross-boundary-alias`, `boundary/ambient-globals`, `boundary/no-test-imports`, `boundary/shared-purity`, `placement/topology`, `health/file-size`, `health/no-nested-ternary`, `types/no-opaque-record`, `types/no-reflect-access` |

`types/no-runtime-typeof` and `types/no-conditional-empty-object-spread` appear in no row
deliberately — both reject code that is often correct. See
[oxlint/types/overview.md](oxlint/types/overview.md) before adopting either.

## Adopting a rule

The consuming project mirrors this tree: a `lint/` directory at the repo root holding `policy/`,
`oxlint/` and `structural/`. Copying a rule then means copying a path, and a rule's tier is as
visible in the project as it is here.

1. **oxlint rules** go into `lint/oxlint/<tag>/`, are registered in `lint/oxlint/plugin.ts`, and are
   switched on in `.oxlintrc.json`. Each rule's spec (`<name>.test.ts`) is copied beside it — it is
   part of the rule, not an optional extra. These are the tier that needs **adapting**: path
   patterns are written against one standard layout and have to be repointed.
2. **Structural checks** go into `lint/structural/<tag>/`, along with the substrate that sits at
   `lint/structural/`: `lib.ts`, `import-graph.ts`, `config.ts`, `registry.ts` and the orchestrator.
   Each exports a check that **returns findings**; the orchestrator owns reporting and the exit
   code. These are **copied, not adapted** — adopting one means writing config, not reimplementing
   an algorithm. See [structural/config.ts](structural/config.ts) for the shape and every rule's
   *Adapt* section for its keys.
3. **Build [graph/import-graph](structural/graph/import-graph.md) before its consumers.** Most
   structural checks answer *where an import lands* rather than *how it is spelled*, and they are
   the ones that break silently when they don't.
4. **Every rule ships with its specs**, including one adversarial case — see *Rule Specs* in
   [enforcement-implementation.md](../enforcement-implementation.md).

The two tiers need separate tsconfig programs, because they run under different runtimes: the
oxlint tier needs `types: ["node"]` for `node:test`, the structural tier `types: ["bun"]`. Both need
`allowImportingTsExtensions`, since every rule imports its neighbours with the `.ts` extension —
oxlint and Bun load these files directly at runtime.

## What is verified before it reaches you

Every rule here, both tiers, is runnable code proved in this repo's CI against three kinds of case:
the **obvious** violation, the **adversarial** spelling that beats a naive implementation, and the
**legal** neighbour that must stay silent. A template edit that breaks a rule fails the pull
request. The two tiers are proved differently because they read differently:

- **oxlint** rules are per-file, so each is exercised through oxlint's `RuleTester` against inline
  sources. The specs ship *beside* the rules, so a project stealing a rule steals its tests in the
  same copy. `bun run check:rules`.
- **Structural** checks scan declared roots rather than being handed a file, so the cases are real
  files in one shared tree under `harness/script-fixtures/tree/`, and the checks are pointed at it
  wholesale by one config object — which doubles as the worked example of adopting the tier.
  Findings are compared as a **multiset with severity** against declared expectations, and every
  registered check must have expectations, so a check that is deleted or stubbed fails rather than
  passing on zero findings. `bun run check:scripts`.

The harness does not ship with the skill directory; it lives in `harness/` beside `skills/` in the
skill's source repository. The rules and their config do ship, which is the point.

**What the harness does not cover for either tier: whether a rule survives adaptation.** Repointing
a path pattern, extending a package list, or adding an exclusion is unverified work. Write the
project's own specs at the same time as the adaptation, not after.
