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

| Rule | Mechanism | Blocking | What it prevents |
|---|---|---|---|
| [no-opaque-record](no-opaque-record.ts) | oxlint | Yes | `Record<string, unknown>` and its other spellings — index signatures, mapped types, `object` values, collapsing unions, and local aliases to any of them |
| [require-safety-comment](require-safety-comment.ts) | oxlint | Yes | Type assertions that state no reason. Requires a `SAFETY:` comment naming the invariant — the catalog's one *justify*, rather than *ban*, rule |
| [no-chained-type-assertions](no-chained-type-assertions.ts) | oxlint | Yes | `value as unknown as T` — a compiler objection deleted rather than answered |
| [no-widen-then-assert](no-widen-then-assert.ts) | oxlint | Yes | A known type discarded to `unknown`/`object`/`Record` and asserted back later in the same function, with nothing checked in between |
| [no-type-argument-assertion](no-type-argument-assertion.ts) | oxlint | Yes | `response.json<User>()`, `parse<Config>(text)`, ``sql<Row>`…` `` — an assertion spelled as a type argument on a call that reads external data, which the three above cannot see |
| [no-known-value-widening](no-known-value-widening.ts) | oxlint | Yes | `const handlers: Record<string, Handler> = {…}` — an annotation that checks a literal by deleting its keys. Use `satisfies` |
| [no-broad-parameters](no-broad-parameters.ts) | oxlint | Yes | `unknown` and `object` function inputs, except the `cause` convention |
| [no-unknown-returns](no-unknown-returns.ts) | oxlint | Yes | Declared return contracts of `unknown`, `any`, `Promise<unknown>`, or an alias to one |
| [no-unknown-type-aliases](no-unknown-type-aliases.ts) | oxlint | Yes | `type ApiPayload = unknown` — a name promising a contract that does not exist |
| [no-reflect-access](no-reflect-access.ts) | oxlint | Yes | `Reflect.get` and `Reflect.apply`, which do ordinary work with the type checking removed |
| [no-runtime-typeof](no-runtime-typeof.ts) | oxlint | Yes | Runtime `typeof` narrowing instead of parsing at the boundary. **Blunt** — see below |
| [no-conditional-empty-object-spread](no-conditional-empty-object-spread.ts) | oxlint | No | `...(x ? { x } : {})` — property omission hidden in a spread. Ships non-blocking |

## The two that are not defaults

Neither appears in the hub's selection table. Both reject code that is often correct.

- **`no-runtime-typeof`** hits the SSR guard (`typeof window === "undefined"`) and any union the compiler already narrowed. This tier has no type information, so the ban is a tooling limit, not a position. The one carve-out is the direct body of a type guard, where the check leaves a named predicate behind; everywhere else, expect per-line disables.
- **`no-conditional-empty-object-spread`** targets an idiom that is deliberate under `exactOptionalPropertyTypes`. A signal about density, not a defect.

`no-broad-parameters`, `no-unknown-returns`, and `no-unknown-type-aliases` share [../lib/type-annotations.ts](../lib/type-annotations.ts) — copy it alongside any of the three.

Adoption mechanics, the spec contract, and cross-tag rule selection: [../overview.md](../overview.md).
