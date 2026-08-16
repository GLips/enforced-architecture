# Rule Catalog

69 enforcement rules across eleven tags. Read this file to choose tags, a tag's `overview.md` to choose rules within it, and a rule's own template — which carries its documentation, *Adapt* section, and implementation — to adapt it.

## The tags

| Tag | Rules | Governs | Read |
|---|---|---|---|
| **boundary** | 12 | What may import what. The only constraint that holds when nobody is reading | [boundary/overview.md](boundary/overview.md) |
| **types** | 12 | Whether a type declaration says anything — untyped bags, `unknown` contracts, unjustified `as` | [types/overview.md](types/overview.md) |
| **structure** | 9 | Where files go, so the paths other rules match are the paths code is in | [structure/overview.md](structure/overview.md) |
| **style** | 9 | Design-system adherence — tokens, primitives, no raw values | [style/overview.md](style/overview.md) |
| **api** | 6 | How deep a permitted import may reach. Barrels and public surface | [api/overview.md](api/overview.md) |
| **react** | 6 | Component-level smells that survive review because each looks reasonable | [react/overview.md](react/overview.md) |
| **effect** | 6 | Effect-TS policy bans — the syntactic residue after @effect/language-service, which owns everything type-aware | [effect/overview.md](effect/overview.md) |
| **health** | 3 | Size and shape signals. Nothing here is a correctness defect | [health/overview.md](health/overview.md) |
| **naming** | 3 | Keeping the public surface findable by plain text search | [naming/overview.md](naming/overview.md) |
| **graph** | 3 | Questions no single file can answer — cycles, coupling. Build the import graph first | [graph/overview.md](graph/overview.md) |
| **testing** | 1 | Tests that pass while the thing they cover is broken | [testing/overview.md](testing/overview.md) |

## Selecting rules

Not every project needs every rule. Use audit findings to guide selection.

| If the project has... | Include these rules |
|---|---|
| Database layer | `boundary/db-isolation`, `structure/schema-placement`, `structure/no-raw-result` |
| `domains/` directory | `boundary/domain-purity`, `api/domain-public-api`, `graph/domain-cycles` |
| Multiple features | `api/feature-public-api`, `graph/feature-deps` |
| Multiple features **and** agents writing most of the code | `api/feature-visibility` — pair-wise opt-in on top of the above |
| SSR / bundle splitting | `api/barrel-direction`, `api/barrel-purity`, `api/server-import-context`, `boundary/client-server-infra` |
| `createServerFn` or `createMiddleware` usage | `structure/server-fn-placement` and `structure/server-fn-validation` for server functions; `structure/no-deprecated-input-validator` and `structure/no-plain-export-in-server-fn-module` for both |
| Intra-feature layers | `graph/import-graph`, `structure/layer-direction`, `boundary/layer-occupancy`, `boundary/server-no-upward` |
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
| Agents writing most of the code | The `types/` assertion trio: `require-safety-comment`, `no-chained-type-assertions`, `no-widen-then-assert` — plus `types/no-type-argument-assertion`, the spelling of the same claim (`api.get<User>(url)`) that all three miss because it never writes `as`. Taking a subset leaves the hole the others close |
| Uses Effect | All `effect/` rules — but adopt `@effect/language-service` first; the `effect/` overview explains why it is step zero and these are only what it leaves on the table |
| A boundary where external data enters (API, queue, file) | `types/no-broad-parameters`, `types/no-unknown-returns`, `types/no-unknown-type-aliases` — these push `unknown` back to the parse site instead of letting it spread inward |
| TypeScript 4.9+ | `types/no-known-value-widening` — the fix it names (`satisfies`) does not exist before that |
| Any TypeScript project | `graph/import-graph`, `boundary/cross-boundary-alias`, `boundary/ambient-globals`, `boundary/no-test-imports`, `boundary/shared-purity`, `structure/topology`, `health/file-size`, `health/no-nested-ternary`, `types/no-opaque-record`, `types/no-reflect-access` |

`types/no-runtime-typeof` and `types/no-conditional-empty-object-spread` appear in no row deliberately — both reject code that is often correct. See [types/overview.md](types/overview.md) before adopting either.

## Adopting a rule

1. **oxlint rules** (`.ts` files) go into the project's `oxlint/rules/` directory, are registered in its `oxlint/plugin.ts`, and are switched on in `.oxlintrc.json`. Each rule's spec (`<name>.test.ts`) is copied beside it — it is part of the rule, not an optional extra. These are the tier that needs **adapting**: path patterns are written against one standard layout and have to be repointed.
2. **Structural scripts** (`.ts` modules beside a `.md`) are copied into the project's `scripts/` directory along with `scripts/lib.ts`, `scripts/import-graph.ts`, `scripts/config.ts` and the orchestrator. Each exports a check that **returns findings**; the orchestrator owns reporting and the exit code. These are **copied, not adapted** — adopting one means writing config, not reimplementing an algorithm. See `scripts/config.ts` for the shape and every rule's *Adapt* section for its keys.
3. **Build [graph/import-graph](graph/import-graph.md) before its consumers.** Most script rules answer *where an import lands* rather than *how it is spelled*, and they are the ones that break silently when they don't.
4. **Every rule ships with its specs**, including one adversarial case — see *Rule Specs* in [enforcement-implementation.md](../enforcement-implementation.md).

## What is verified before it reaches you

Every rule here, both tiers, is runnable code proved in this repo's CI against three kinds of case: the **obvious** violation, the **adversarial** spelling that beats a naive implementation, and the **legal** neighbour that must stay silent. A template edit that breaks a rule fails the pull request. The two tiers are proved differently because they read differently:

- **oxlint** rules are per-file, so each is exercised through oxlint's `RuleTester` against inline sources. The specs ship *beside* the rules, so a project stealing a rule steals its tests in the same copy. `bun run check:rules`.
- **Script** rules scan declared roots rather than being handed a file, so the cases are real files in one shared tree under `harness/script-fixtures/tree/`, and the checks are pointed at it wholesale by one config object — which doubles as the worked example of adopting the tier. Findings are compared as a **multiset with severity** against declared expectations, and every registered check must have expectations, so a check that is deleted or stubbed fails rather than passing on zero findings. `bun run check:scripts`.

The script harness does not ship with the skill directory; it lives in `harness/` beside `skills/` in the skill's source repository. The rules and their config do ship, which is the point.

**What the harness does not cover for either tier: whether a rule survives adaptation.** Repointing a path pattern, extending a package list, or adding an exclusion is unverified work. Write the project's own specs at the same time as the adaptation, not after.
