# react/prop-count

| Field | Value |
|---|---|
| **Tag** | react |
| **Mechanism** | oxlint JS plugin (per-file, real-time) |
| **Blocking** | No (warning only) |

## What it prevents

A component whose interface has grown wider than anyone can hold. Eight props is rarely eight independent decisions — it is usually a component doing two jobs, a group of props that always travel together and were never given a name, or data drilled through an intermediary that has no use for it.

A wide prop surface is also hard to call correctly. Every optional prop multiplies the states the component can be in, and the call sites drift apart until no two of them configure it the same way.

The fix depends on which of those it is:

- **Decompose** — split into components with narrower interfaces, when the props divide cleanly along the lines of what the component renders.
- **Group** — combine props that move together into one object, when they are already a concept (`layout`, `pagination`) that has no name yet.
- **Context** — lift the ones being threaded through, when the intermediary does not read them.
- **Composition** — take `children` or a render prop, when the parent should own a rendering decision the props are currently encoding.

## Why a rule and not a script

It is a count against a **threshold**, but a threshold is a rule option and always was. What kept these three in the structural tier was the rule tier being GritQL: a declarative matcher cannot accumulate a count and compare it to a number. A JS plugin is a stateful visitor, so it can.

The move is worth more than tier tidiness. Everything these rules ask — is this a component, what are its parameters, what does its props type declare — is a question about syntax, and a structural tier answers it by re-implementing a TypeScript parser out of regexes and brace counting. Every silent failure in these three rules' history came from that parser, not from the counting.

"What is a component" is still one question for all three, answered once in [`lib/component-declarations.ts`](../lib/component-declarations.ts). A declaration form one of them fails to recognise is a component all three skip in silence.

## Why two strategies

Props are declared in two ways, and each hides the other's count.

1. **The component's `<Name>Props` type or interface**, when it has one. This is the more accurate of the two: it sees props the body never destructures, and it sees optional props that no call site happens to pass.
2. **The destructuring pattern in the parameter list**, when there is no such type. This is what catches the component annotated with an inline type literal, or with no annotation at all.

The type is tried first and the destructure is the fallback, because a component with a named Props type may still take `props` whole — `function WideTyped(props: WideTypedProps)` has nothing to destructure, and a destructure-only implementation reads it as zero props and stays quiet.

## Base types, and the floor

Most of a wide prop surface is often declared to the *left* of the brace:

```ts
type XProps = Model & { onThing: () => void };
interface XProps extends Model { onThing: () => void }
```

Both spellings are counted: the members of every intersection term and every heritage entry are merged in, recursively, when the named type is declared in the **same file**. This is not an edge case — the intersection is what a component reaches for once its surface has grown wide enough to want a name, so a reader that took only the members between the braces went quiet at exactly the size it exists to report.

Names are merged as a **set**. `Model & { tone?: Tone }` narrowing a member `Model` already declares is one prop in TypeScript and is one prop here.

**A base the check cannot read out of this file contributes nothing, and the count becomes a floor.** That is either a type declared in another file, or one declared here whose body is not an object it can enumerate — `type BoxBehaviourProps = Pick<ViewProps, …>`. The finding reports "at least N props" and names the base, not whatever is inside it. Two alternatives were available and both are worse: staying silent is the under-count that made this check miss an eight-prop component while looking green, and reporting every component with an imported base would put a permanent, unactionable warning on every `extends ViewProps` in a React Native codebase — the defect that teaches people to scroll past a check. A floor can miss a wide component; it can never invent one.

Cross-file resolution would shrink that blind spot but not close it, since the common base is `ViewProps` from a `.d.ts` in `node_modules`. It is deliberately not attempted.

## Where it applies

Every `.tsx` file except tests and scripts. Every exported component declaration is its own subject, so a file with two components is two counts and not one sum.

## Negative space

**`children` and `...rest` are not props.** `children` is a structural convention rather than a data dependency, and `...rest` is explicit forwarding — the component is passing those through, not consuming them. Both are excluded in both strategies.

**The annotation wins over the destructure, and they are never summed.** `({ a, b }: { a: string; b: string })` declares two props twice, and counting both halves doubles every name — enough to carry a seven-prop component over an eight-prop threshold. The destructure is read only when there is no annotation to read. Over-counting is invisible to every firing case and is the defect that teaches people to scroll past a rule, which is why the legal neighbours sit one prop under the line rather than comfortably below it.

**Only BASES expand; member types do not.** `result: ScanResultViewModel` is one prop whose type happens to be named, and expanding it would report the very shape this rule asks for — grouping props that travel together into one object — as a violation. A rule that argues against its own advice is one nobody follows.

**A member declared on both sides of an intersection is one prop.** `Model & { tone?: Tone }` narrowing a member `Model` already declares is one prop in TypeScript. Names merge as a set for that reason.

**Nested members are one prop.** `layout: { columns: number; dense: boolean }` is a single property signature, whatever its own type contains.

**A method signature is a prop.** `onDone(): void` and `onDone: () => void` declare the same surface and are indistinguishable to a caller.

**A union of prop shapes is a floor, not a count.** `type XProps = A | B` has members this walk never reaches, and so does a mapped or utility type. Each is reported as a floor rather than as a total.

**A `memo`/`forwardRef` binding is unwrapped, not skipped.** The props belong to the function inside the wrapper. `memo(CardImpl)`, handed a reference rather than a function literal, has its surface declared elsewhere and is not counted here.

## Adapt

One knob, in `.oxlintrc.json`:

```json
"arch/prop-count": ["warn", { "threshold": 8 }]
```

The prop count at which a component is reported, inclusive. Raise it for a design-system package, where `Button`, `Input` and `Table` are configurable by intent and a low threshold reports the whole library. Lower it for an application with strict composition patterns. Calibrate against the current tree and set it just above, so it signals growth rather than firing on day one.

Which files are read is `isArchitectureExemptPath`, shared with every rule in the catalog — never restated here.

The props type is reached through the parameter's **annotation**, so there is no naming convention to configure. A project that spells it `ComponentAttrs`, or annotates with a type whose name has nothing to do with the component's, is read the same way.

## Implementation

[`react/prop-count.ts`](prop-count.ts), registered in [`plugin.ts`](../plugin.ts). Registration and activation are separate: a rule the plugin exports but `.oxlintrc.json` never names is loaded and never run.

## Example output

```
src/features/billing/ui/plan-selector.tsx:18:8: warning arch(prop-count): PlanSelector has 12
props (threshold: 8). Decompose into smaller components, group props that always travel together
into one object, or lift shared data into context. If the wide surface is deliberate — a
design-system primitive, or a wrapper forwarding to a third party — raise the threshold in the
project's oxlint config.

src/shared/ui/box.tsx:50:17: warning arch(prop-count): Box has at least 9 props (threshold: 8).
That is a floor: this rule could not read BoxBehaviourProps out of this file, and it resolves a
base type by name within one file, so the real surface is wider. Decompose into smaller
components, group props that always travel together into one object, or lift shared data into
context.
```

## Why non-blocking

The false positives are real ones. Design-system primitives expose many configuration props on purpose. A wrapper around a third-party component has to forward what that component takes. Some components genuinely have eight independent props, and grouping them would invent an object that models nothing.

So the count surfaces the pattern and the developer decides. Blocking on a heuristic this soft buys a suppression comment and loses the signal.
