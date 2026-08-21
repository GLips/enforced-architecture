# types — Type evidence

The other tags govern *where code lives*. This one governs whether a type declaration says anything.
`Record<string, unknown>`, an `unknown` return, a bare `as` — each one compiles, reads as deliberate,
and pushes the real work onto every caller.

The tag has twelve rules and **five of them run here**. The other seven ask what a declaration
MEANS, which no per-file matcher can answer, and they run in the structural tier against a real
TypeScript program: [../../structural/types/overview.md](../../structural/types/overview.md). The
split is not a preference. It is the line between "this file writes `as`" — syntax, decidable here —
and "this annotation resolves to something broad" — a question about a type, decidable only where a
checker is.

A project that runs oxlint and skips the structural tier has five of the twelve. Its `types` tag is
about assertions and nothing else, and no run says so.

## The assertion trio

Three rules interlock. Take them together. Alone, each has a hole the other two close.

- **[require-safety-comment](require-safety-comment.ts)** makes every assertion state its invariant.
  It accepts one sentence covering a whole chain.
- **[no-chained-type-assertions](no-chained-type-assertions.ts)** closes that hole. It sees only
  assertions stacked in one expression.
- **[no-widen-then-assert](../../structural/types/no-widen-then-assert.ts)** catches the same round
  trip split across statements. Neither of the others can see it. A `SAFETY:` comment would
  otherwise silence it permanently, with a sentence that is true and useless. It lives in the
  structural tier because following a binding to its declaration and asking what that declaration's
  type was is the checker's job — the syntactic version could see only the widenings written out,
  and treated every call as a boundary because it could not read a return type.

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

## Rules

| Rule | Blocking | What it buys |
|---|---|---|
| [require-safety-comment](require-safety-comment.ts) | Yes | `rg "SAFETY:"` lists each place the code overrules the compiler, and each one names its invariant |
| [no-chained-type-assertions](no-chained-type-assertions.ts) | Yes | Every assertion keeps the overlap check, so a change to the target type still reports |
| [no-type-argument-assertion](no-type-argument-assertion.ts) | Yes | External data takes its type from a parser, so a response that lost a field fails at the parse |
| [no-reflect-access](no-reflect-access.ts) | Yes | A property rename and a wrong argument count still fail to compile. **Reports correct code** — see below |
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

## The one with no row in the hub's table

`no-conditional-empty-object-spread` ships on, at `warn`, and has no row because its subject is any
TypeScript file rather than a structure a project either has or lacks. It targets an idiom that is
deliberate under `exactOptionalPropertyTypes`: a signal about density, not a defect.

[../lib/parameter-shapes.ts](../lib/parameter-shapes.ts) used to be this tag's shared reading and is
not any more — it is 54 lines answering which node holds a parameter's annotation, and
[react/prop-count](../react/prop-count.ts) is its only reader. Nothing in this tag needs it. A rule
added here that wants to know what a type MEANS belongs in the structural tier; one that grows a
second syntactic approximation in `lib/` is the near-copy this catalog keeps producing.

Adoption mechanics, the spec contract, and cross-tag rule selection: [../../overview.md](../../overview.md).
