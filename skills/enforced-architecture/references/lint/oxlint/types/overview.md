# types — Type evidence

The other tags govern *where code lives*. This one governs whether a type declaration says
anything. `Record<string, unknown>`, an `unknown` return, a bare `as` — each one compiles, reads as
deliberate, and pushes the real work onto every caller.

## The assertion trio

Three rules interlock. Take them together. Alone, each has a hole the other two close.

- **[require-safety-comment](require-safety-comment.ts)** makes every assertion state its invariant.
  It accepts one sentence covering a whole chain.
- **[no-chained-type-assertions](no-chained-type-assertions.ts)** closes that hole. It sees only
  assertions stacked in one expression.
- **[no-widen-then-assert](no-widen-then-assert.ts)** catches the same round trip split across
  statements. Neither of the others can see it. A `SAFETY:` comment would otherwise silence it
  permanently, with a sentence that is true and useless.

All three key on `as` and its angle-bracket twin. So all three are silent on the spelling that hides
the same claim in a type argument: `response.json<User>()`, ``gql<Data>`…` ``.
**[no-type-argument-assertion](no-type-argument-assertion.ts)** covers that one. It is the spelling
an agent reaches for after the other three refuse, because it reads as ordinary typed API usage
rather than as an override. It leaves one name alone: `sql`.
[effect/no-sql-type-parameter](../effect/no-sql-type-parameter.ts) owns the typed query and names
the `SqlSchema` decode as the fix.

`require-safety-comment` is the catalog's one *justify* rather than *ban* rule. Some assertions are
correct, and no per-file rule can tell which. So it leaves the hatch open and makes using it leave a
trace. `rg "SAFETY:"` is most of the value.

## The open-dictionary trio

Three rules key on the same type from three directions: `Record<string, unknown>`, and its
index-signature and mapped-type spellings. [../lib/type-annotations.ts](../lib/type-annotations.ts)
owns the answer, so they cannot drift apart. Three private copies is the shape this defect takes
here, and it hides well. Each rule stays green while going silent on a spelling its sibling reports,
so the disagreement shows up as a bypass rather than as a failure.

- **[no-opaque-record](no-opaque-record.ts)** bans the type at the declaration.
- **[no-widen-then-assert](no-widen-then-assert.ts)** catches a known value routed through one and
  asserted back.
- **[no-known-value-widening](no-known-value-widening.ts)** catches an annotation deleting a
  literal's keys.

The question has two halves. Is the key domain open, and is the value opaque. The first two rules
ask both. `no-known-value-widening` asks only the first. That is why `Record<string, Handler>`
reports there and is legal in the other two: what it watches is the keys, whatever the value type
says. That row is a fixture in all three specs. It is the only place the three are meant to
disagree.

A key domain is CLOSED when this file says what the keys are. A literal type. A union of them. A
template literal whose every hole is closed. `(typeof KEYS)[number]` where this file declares `KEYS`
with `as const`. A local enum, or a member of one. The key-preserving builtins — `Exclude`,
`Extract`, `Uppercase` and their siblings — over a closed argument. A type parameter in scope. A
local alias to any of those. Everything else is open.

The list enumerates what is closed, and that direction is deliberate. A list of the OPEN spellings
reads as more precise and goes silent on every spelling nobody thought of. `Record<any, unknown>`
and ``Record<`user_${string}`, unknown>`` are both bags, and each is one token away from the
spelling the rule does catch.

`keyof X` is closed for any `X` but `any`, and it is the one arm that trusts a name it cannot read.
That is a trade. `Record<keyof Config, unknown>` over an imported `Config` is the dirty-field
tracker `no-opaque-record`'s own message asks for, and reporting it would leave no fix but a disable
comment. The price is that `keyof` of a type that is itself a bag stays silent:
`type Loose = { [k: string]: number }` makes `Record<keyof Loose, unknown>` a bag, unreported.

**Negative space.** Four items, and the first three follow from that one gate.

- A closed key domain with opaque values is covered by nothing. `Record<'draft' | 'paid', unknown>`
  and `{ [K in keyof T]: unknown }` are silent in all three rules. A misspelled key is already a
  compile error there. The reads still need casts, and no rule in this catalog says so.
- A domain the walk cannot resolve reports even when it is finite in fact. An imported alias, an
  imported enum, a member of an imported enum, an enum nested in a `namespace`, a conditional type,
  an indexed access into a named type such as `Row['id']` — every string whenever `Row.id` is one —
  a bare `typeof x` naming a local `const`, and `(typeof X)[…]` where `X` is declared inside a
  function rather than at the top level. The fix is to spell the union or name the shape.
- `no-widen-then-assert` reads a whole annotation, so it sees a bag only where one is written out.
  `Partial<Record<string, unknown>>`, `Readonly<Record<…>>` and an interface carrying an index
  signature are silent there. `no-opaque-record` reports the inner `Record` or index signature at
  its declaration, so none of those types can exist inside a declared tree to be widened through.
  That backstop is what makes the silence safe. It is not coverage on its own.
- The same wrappers are silent in `no-known-value-widening`, and there the backstop does not apply.
  `Partial<Record<string, Handler>>` over a literal has a precise value type, so `no-opaque-record`
  is correctly silent on it too. Unwrapping means deciding which generics preserve a key domain,
  which is a predicate rather than vocabulary — the one thing this catalog will not take as config.

## Rules

| Rule | Blocking | What it buys |
|---|---|---|
| [no-opaque-record](no-opaque-record.ts) | Yes | A misspelled key is a compile error and not `undefined` at run time, in every spelling of the open dictionary |
| [require-safety-comment](require-safety-comment.ts) | Yes | `rg "SAFETY:"` lists each place the code overrules the compiler, and each one names its invariant |
| [no-chained-type-assertions](no-chained-type-assertions.ts) | Yes | Every assertion keeps the overlap check, so a change to the target type still reports |
| [no-widen-then-assert](no-widen-then-assert.ts) | Yes | A known type survives to the end of the function, so a field rename still reports at each use |
| [no-type-argument-assertion](no-type-argument-assertion.ts) | Yes | External data takes its type from a parser, so a response that lost a field fails at the parse |
| [no-known-value-widening](no-known-value-widening.ts) | Yes | A literal keeps its own keys: `handlers.stpo` is an error and the editor lists the keys |
| [no-broad-parameters](no-broad-parameters.ts) | Yes | A body reads a parameter with no guard and no cast, and a wrong argument fails at the call site |
| [no-unknown-returns](no-unknown-returns.ts) | Yes | A caller reads a field off the result with no narrowing of its own |
| [no-unknown-type-aliases](no-unknown-type-aliases.ts) | Yes | A name in a signature states a contract; no alias chain ends at `unknown` |
| [no-reflect-access](no-reflect-access.ts) | Yes | A property rename and a wrong argument count still fail to compile. **Reports correct code** — see below |
| [no-runtime-typeof](no-runtime-typeof.ts) | Yes | Each representation check sits in one named guard or one schema. **Reports correct code** — see below |
| [no-conditional-empty-object-spread](no-conditional-empty-object-spread.ts) | No | Shows which object literals do not state their own keys. Ships non-blocking |

## The default that still reports correct code

`no-reflect-access` is in the hub's selection table and ships at `error`. It costs something anyway.

It reports a `namespace Reflect` — or an `import Reflect = <entity>` — that has value members. That
is a real binding, not the builtin. Separating those from the kinds TypeScript erases means
reimplementing its instantiation rule out of one file's syntax, and each erased kind left alone is a
one-line, file-wide off-switch. A per-line disable is the answer for a real one. That trade is why
the rule is not switchable off wholesale.

It reports one more thing on purpose: a value-position `typeof Reflect.get === "function"`. Its
subject is the member READ rather than the call. That is what closes `Reflect.get.call(…)`, a
one-token rewrite no call-shaped matcher can see — and a feature-detect is that same read. The
type-position `type G = typeof Reflect.get` is a type query, not a member expression, and is silent.

It does not see the builtin reached any other way. Every such spelling puts it somewhere else
*before* a member is read off the identifier: `globalThis.Reflect.get(…)`, `const R = Reflect`,
`const Reflect = globalThis.Reflect`, a destructured `const { get } = Reflect`, or a
template-literal key. Closing that family takes type information, and this tier has none.

## The two with no row in the hub's table

Both ship on — `no-runtime-typeof` at `error`, `no-conditional-empty-object-spread` at `warn`. They
have no row because their subject is any TypeScript file, rather than a structure a project either
has or lacks. Both reject code that is often correct.

- **`no-runtime-typeof`** hits the SSR guard (`typeof window === "undefined"`) and any union the
  compiler already narrowed. This tier has no type information, so the ban is a tooling limit, not a
  position. The one carve-out is the direct body of a type guard, where the check leaves a named
  predicate behind. Everywhere else, expect per-line disables.
- **`no-conditional-empty-object-spread`** targets an idiom that is deliberate under
  `exactOptionalPropertyTypes`. A signal about density, not a defect.

Seven rules share [../lib/type-annotations.ts](../lib/type-annotations.ts). Copy it alongside any of
them. It owns what counts as a type-guard signature, which is why `no-broad-parameters` exempts the
value a guard vouches for and `no-runtime-typeof` allows the `typeof` inside that guard from one
reading. It owns what resolves to a broad type, for `no-unknown-returns` and
`no-unknown-type-aliases`. And it owns the open-dictionary question, for the trio above.

Adoption mechanics, the spec contract, and cross-tag rule selection: [../../overview.md](../../overview.md).
