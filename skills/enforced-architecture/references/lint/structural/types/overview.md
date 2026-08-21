# types — Type evidence, with a checker

The half of the `types` tag that asks what a declaration MEANS rather than how it is spelled. Every
check here calls the TypeScript compiler through [../type-checker.ts](../type-checker.ts), so
`Promise<unknown>`, an alias two files away and an interface carrying an index signature are the
same answer as the shape written out. The per-file half — the assertions, which are syntax and need
no checker — is in [../../oxlint/types/overview.md](../../oxlint/types/overview.md).

These seven ran in the oxlint tier first. What that cost is on the record: the shared syntactic
reading they leaned on was 736 lines, ~340 of them enumerating the spellings of "open key domain"
and "resolves to something broad", and both questions are now one call each in
[type-shapes.ts](type-shapes.ts).

| Rule | Blocking | What it buys |
|---|---|---|
| [no-opaque-record](no-opaque-record.ts) | Yes | A misspelled key is a compile error and not `undefined` at run time, in every spelling of the open dictionary |
| [no-widen-then-assert](no-widen-then-assert.ts) | Yes | A known type survives to the end of the function, so a field rename still reports at each use |
| [no-known-value-widening](no-known-value-widening.ts) | Yes | A literal keeps its own keys: `handlers.stpo` is an error and the editor lists the keys |
| [no-broad-parameters](no-broad-parameters.ts) | Yes | A body reads a parameter with no guard and no cast, and a wrong argument fails at the call site |
| [no-unknown-returns](no-unknown-returns.ts) | Yes | A caller reads a field off the result with no narrowing of its own |
| [no-unknown-type-aliases](no-unknown-type-aliases.ts) | Yes | A name in a signature states a contract; no alias chain ends at `unknown` |
| [no-runtime-typeof](no-runtime-typeof.ts) | Yes | Each representation check over an untyped value sits in one named guard or one schema |

## Declaring where the checker looks

Each declared tree names the `tsconfig` whose program contains it. That is a path, not compiler
options — the project already has a tsconfig, and a second set of options in a lint config is a
second answer to what the code compiles as.

A tree whose tsconfig does not compile every `.ts`/`.tsx`/`.mts`/`.cts` file in it — minus the tests,
scripts, generated and ambient files every check already exempts — fails the run with the paths
named. It is not a warning, because the alternative is worse: a check whose program holds none of
the tree's files reports nothing, and nothing is what a clean tree reports too.

## The open-dictionary trio

Three checks key on the same type from three directions: `Record<string, unknown>`, and its
index-signature and mapped-type spellings. [type-shapes.ts](type-shapes.ts) owns the answer, so they
cannot drift apart. Three private copies is the shape this defect takes here, and it hides well:
each check stays green while going silent on a spelling its sibling reports, so the disagreement
shows up as a bypass rather than as a failure.

- **[no-opaque-record](no-opaque-record.ts)** bans the type at the declaration.
- **[no-widen-then-assert](no-widen-then-assert.ts)** catches a known value routed through one and
  asserted back.
- **[no-known-value-widening](no-known-value-widening.ts)** catches an annotation deleting a
  literal's keys.

The question has two halves. Is the key domain open, and is the value opaque. The first two ask
both. `no-known-value-widening` asks only the first. That is why `Record<string, Handler>` reports
there and is legal in the other two: what it watches is the keys, whatever the value type says.
That row is a fixture in all three expectation files. It is the only place the three are meant to
disagree.

**A key domain is open exactly when the type has an index signature.** That is not a heuristic and
not a list — it is what TypeScript's own model means by an open domain. `Record<string, T>`,
`{ [k: string]: T }` and `{ [K in string]: T }` produce one; `Record<'draft' | 'paid', T>`,
`{ [K in keyof Config]: T }`, an enum key and `(typeof KEYS)[number]` produce properties instead.
Nothing here enumerates spellings, so there is no spelling to have missed.

**What the checker changed, stated as a diff.** These were documented holes in the oxlint tier and
they are closed:

- A key domain the syntactic walk could not resolve reported even when it was finite in fact — an
  imported alias, an imported enum, a conditional type, `Row['id']`, a `const` declared inside a
  function. Those false positives are gone.
- `Partial<Record<string, unknown>>`, `Readonly<Record<…>>` and an interface carrying an index
  signature were silent as widening targets in two of the three. They report now. The old note that
  `no-opaque-record` was a "backstop" making that silence safe is retired with them.
- An alias chain, an alias declared inside a function or a namespace, and an alias to a name from a
  dependency all resolve. `no-unknown-type-aliases` read only top-level aliases in the file it was
  handed.

**Negative space.** What is still uncovered, and deliberately:

- A closed key domain with opaque values is covered by nothing. `Record<'draft' | 'paid', unknown>`
  and `{ [K in keyof T]: unknown }` are silent in all three. A misspelled key is already a compile
  error there. The reads still need casts, and no check in this catalog says so.
- An ARRAY is not a bag. `unknown[]`, `Array<unknown>` and `ReadonlyArray<unknown>` all carry a
  number index signature, and an open numeric domain is what an array is — the trio is silent on all
  three spellings, in a way that does not depend on which one was written. The broadness of the
  ELEMENT is a signature question and reports at the parameter or return type that names it.
- An UNINSTANTIATED generic mapped type is invisible. `type Bag<K extends string> = { [P in K]: V }`
  has no index signature until `K` is bound, so the alias itself is silent and each instantiation is
  judged on its own.
- Nothing here reads `node_modules`. An alias to a broad type from a dependency reports at the local
  alias and never at the dependency.

## No per-line escape, and one list that is a coverage list

This tier has no `eslint-disable`, and none is planned. Every finding in every walked file is
reported, so the recoveries these checks name in their messages — parse at the boundary, name the
type, write the guard — are the only ones there are. Four of these seven could be silenced a line at
a time in the oxlint tier. The move took that away, and adopters who had the old rules should expect
that as the visible change.

The one thing an adopter genuinely edits here is `TRANSPARENT_CONTAINER_NAMES` in
[type-shapes.ts](type-shapes.ts), which is what a signature is read THROUGH: `Promise<unknown>`
answers as `unknown` because `Promise` is in it. Adding a project's own `Result<T, E>` is the
adaptation it exists for. Removing one of the four shipped names is not — it makes
`ReadonlyArray<unknown>` a contract again, which is an off-switch wearing a list. `bp-spellings.ts`
pins all four, so the deletion fails the suite instead of going quiet.

## `no-runtime-typeof` is a redesign, not a port

Its oxlint-tier predecessor banned every runtime `typeof` outside a type guard and said so in its
own header: the ban was a tooling limit, not a position. It listed the correct code it reported
anyway — the SSR guard, and the discrimination of a union the compiler had already narrowed — and
told adopters to expect per-line disables.

The limit is gone, so the ban is. A `typeof` reports when the operand is `unknown`, `any` or
`object`; over a type, it is ordinary control flow and is silent. Two behaviour changes follow, both
intended: `typeof window === "undefined"` no longer reports, and neither does
`typeof value === "string"` over `string | number`. A project that wants the old total ban does not
get it back by configuring this check. It gets it by not writing `typeof`.

The type-guard exemption stays, because it is what makes the check actionable: the fix for a
reported `typeof` is to move it into a function returning `value is T`.
[type-shapes.ts](type-shapes.ts) owns what a guard is and `no-broad-parameters` reads the same
answer to exempt the value that guard vouches for, so one check cannot demand the signature the
other reports.

Adoption mechanics, the spec contract, and what part of the tree owns each check's subject:
[../../overview.md](../../overview.md).
