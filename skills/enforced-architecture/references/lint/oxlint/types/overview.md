# types — Type evidence

The other tags govern *where code lives*; this one governs whether a type declaration says anything. `Record<string, unknown>`, an `unknown` return, a bare `as` — each compiles, reads as deliberate, and pushes the real work onto every caller.

## The assertion trio

Three rules interlock and should be taken together — alone, each has a hole the other two close:

- **[require-safety-comment](require-safety-comment.ts)** makes every assertion state its invariant, but accepts one sentence covering a whole chain.
- **[no-chained-type-assertions](no-chained-type-assertions.ts)** closes that, but only sees assertions stacked in one expression.
- **[no-widen-then-assert](no-widen-then-assert.ts)** catches the same round trip split across statements, which neither of the others can see — and which a `SAFETY:` comment will otherwise silence permanently with a sentence that is true and useless.

All three key on `as` and its angle-bracket twin, so all three are silent on the spelling that hides the same claim in a type argument — `response.json<User>()`, ``sql<Row>`…` ``. **[no-type-argument-assertion](no-type-argument-assertion.ts)** covers that one, and it is the spelling an agent reaches for after the other three have refused it, because it reads as ordinary typed API usage rather than as an override.

`require-safety-comment` is the catalog's one *justify* rather than *ban* rule — some assertions are correct and no per-file rule can tell which, so it leaves the hatch open and makes using it leave a trace. `rg "SAFETY:"` is most of the value.

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
| [no-reflect-access](no-reflect-access.ts) | Yes | A property rename and a wrong argument count still fail to compile |
| [no-runtime-typeof](no-runtime-typeof.ts) | Yes | Each representation check sits in one named guard or one schema. **Reports correct code** — see below |
| [no-conditional-empty-object-spread](no-conditional-empty-object-spread.ts) | No | Shows which object literals do not state their own keys. Ships non-blocking |

## The two that are not defaults

Neither appears in the hub's selection table. Both reject code that is often correct.

- **`no-runtime-typeof`** hits the SSR guard (`typeof window === "undefined"`) and any union the compiler already narrowed. This tier has no type information, so the ban is a tooling limit, not a position. The one carve-out is the direct body of a type guard, where the check leaves a named predicate behind; everywhere else, expect per-line disables.
- **`no-conditional-empty-object-spread`** targets an idiom that is deliberate under `exactOptionalPropertyTypes`. A signal about density, not a defect.

`no-broad-parameters`, `no-unknown-returns`, and `no-unknown-type-aliases` share [../lib/type-annotations.ts](../lib/type-annotations.ts) — copy it alongside any of the three.

Adoption mechanics, the spec contract, and cross-tag rule selection: [../../overview.md](../../overview.md).
