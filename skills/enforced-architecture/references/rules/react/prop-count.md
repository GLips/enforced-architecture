# react/prop-count

| Field | Value |
|---|---|
| **Tag** | react |
| **Mechanism** | Structural script (counts across a file set, pre-commit + CI) |
| **Blocking** | No (warning only) |

## What it prevents

A component whose interface has grown wider than anyone can hold. Eight props is rarely eight independent decisions — it is usually a component doing two jobs, a group of props that always travel together and were never given a name, or data drilled through an intermediary that has no use for it.

A wide prop surface is also hard to call correctly. Every optional prop multiplies the states the component can be in, and the call sites drift apart until no two of them configure it the same way.

The fix depends on which of those it is:

- **Decompose** — split into components with narrower interfaces, when the props divide cleanly along the lines of what the component renders.
- **Group** — combine props that move together into one object, when they are already a concept (`layout`, `pagination`) that has no name yet.
- **Context** — lift the ones being threaded through, when the intermediary does not read them.
- **Composition** — take `children` or a render prop, when the parent should own a rendering decision the props are currently encoding.

## Why this is a script and not a lint rule

The answer is a count against a **threshold**, and a threshold is project calibration rather than a fact about the code. A design-system package and an application want different numbers, and that number belongs in the one config object beside the other counting checks.

"What is a component" is also a question three checks ask. This one, `react/hook-count` and `react/single-component-export` resolve it through the shared classifier in `scripts/component-declarations.ts`, so they govern the same set of declarations instead of holding three private opinions about it. A declaration form one of them fails to recognise is a component all three skip in silence.

## Why two strategies

Props are declared in two ways, and each hides the other's count.

1. **The component's `<Name>Props` type or interface**, when it has one. This is the more accurate of the two: it sees props the body never destructures, and it sees optional props that no call site happens to pass.
2. **The destructuring pattern in the parameter list**, when there is no such type. This is what catches the component annotated with an inline type literal, or with no annotation at all.

The type is tried first and the destructure is the fallback, because a component with a named Props type may still take `props` whole — `function WideTyped(props: WideTypedProps)` has nothing to destructure, and a destructure-only implementation reads it as zero props and stays quiet.

## Where it applies

Every `.tsx` file under the configured component roots, walked from the **source root**: `features/*/ui`, `shared/ui`, `routes` by default. Every exported component declaration in those files is its own subject, so a file with two components is two counts and not one sum.

## Negative space

**`children` and `...rest` are not props.** `children` is a structural convention rather than a data dependency, and `...rest` is explicit forwarding — the component is passing those through, not consuming them. Both are excluded in both strategies.

**The destructure region ends at the destructure's OWN closing brace, never the last brace in the signature.** A component annotated with an inline type literal — `({ a, b }: { a: string; b: string })`, which is how most of them are written — puts a second brace pair immediately after the first, and the type repeats every name the pattern already counted. Reading to the last brace doubles the count and carries a seven-prop component over an eight-prop threshold. Over-counting is invisible to every firing fixture and is the defect that teaches people to scroll past a check, which is why the legal neighbours sit one prop under the line rather than comfortably below it.

**A depth counter must not treat the `>` of an arrow as a closing bracket.** `onDone: (id: string) => void` is an ordinary member type, and a naive counter drops below zero at the first one, then splits everything after it in the wrong places — the remaining members merge into one token and a nine-prop interface scores three. Under the threshold, silent. `splitTopLevel` in `scripts/lib.ts` holds that guard, which is most of the reason this check does not write its own splitter.

**A `<Name>Props` declaration may carry a type-parameter list.** `interface OptionListProps<T> {` is the ordinary generic spelling, and a pattern demanding `{` or `=` immediately after the name does not see it. The declaration is then missed, the check falls through to the destructure strategy, and a component taking `props` whole reports nothing at all.

**A signature the check cannot read is reported, not skipped.** When the parameter list has no closing paren within the classifier's line budget the finding is a blocking **error** naming the component — because a component the check cannot read is a component it never reports on, and silence there is indistinguishable from a pass. The usual cause is an unbalanced paren in a template literal further up the file.

**Nested members are one prop.** `layout: { columns: number; dense: boolean }` is a single property signature; counting every `name:` inside the type body instead of every top-level member inflates it by the size of its own type.

**A `memo`/`forwardRef` binding is skipped as a subject.** What the classifier captures there is the wrapper call's arguments, not props. The wrapped function is found on its own line and counted there.

**A configured root that does not exist reports nothing.** That tolerance is deliberate and it is also how a root goes unexercised for months while looking fine, which is why the fixture tree carries a firing case outside `features/*/ui`.

## Adapt

Both knobs are `config.checks["react/prop-count"]`:

- **`threshold`** — the prop count at which a component is reported, inclusive. Raise it for a design-system package, where `Button`, `Input` and `Table` are configurable by intent and a low threshold reports the whole library. Lower it for an application with strict composition patterns. Calibrate against the current tree and set it just above, so it signals growth rather than firing on day one.
- **`targetDirs`** — globs naming where components live, **relative to the source root**, not the project root. Globbed rather than listed because `features/*/ui` is a set that grows. A mistyped entry is silence, not an error.

Test files, generated files and declaration files come out of `source.exclude`, which every check shares — never restate them here.

A project whose convention is `ComponentAttrs` or `ComponentConfig` rather than `ComponentProps` changes the suffix in the implementation, not in config: the name is one string in `propsFromType`, and making it a knob would invite a list of suffixes where the point is that a codebase has one.

## Implementation

[`react/prop-count.ts`](prop-count.ts), behind the structural orchestrator. It returns findings and never prints or exits; reporting, warning suppression for files a commit did not touch, and the exit code all belong to `scripts/run-structural-checks.ts`.

## Example output

```
WARN [react/prop-count] src/features/billing/ui/plan-selector.tsx:18
  PlanSelector has 12 props (threshold: 8).
  Decompose into smaller components, group props that always travel together
  into one object, or lift shared data into context. If the wide surface is
  deliberate — a design-system primitive, or a wrapper forwarding to a third
  party — raise the threshold in the project's architecture config.

FAIL [react/prop-count] src/shared/ui/data-table.tsx:32
  Could not read DataTable's parameter list: the paren never closes.
  prop-count is blind to this component until that is resolved, and a component
  the check cannot read is one it never reports on — look for an unbalanced paren
  in a template literal above the declaration.
```

## Why non-blocking

The false positives are real ones. Design-system primitives expose many configuration props on purpose. A wrapper around a third-party component has to forward what that component takes. Some components genuinely have eight independent props, and grouping them would invent an object that models nothing.

So the count surfaces the pattern and the developer decides. Blocking on a heuristic this soft buys a suppression comment and loses the signal.

The one blocking finding is the unreadable signature above, and it is a different claim: not "this component is too wide" but "this check cannot see this component."
