# react/single-component-export

| Field | Value |
|---|---|
| **Tag** | react |
| **Mechanism** | Structural script (per-file counting, pre-commit + CI) |
| **Blocking** | No (warning only) |

Implementation: [single-component-export.ts](single-component-export.ts). The declaration forms it counts come from the shared classifier in [scripts/component-declarations.ts](../scripts/component-declarations.ts).

## What it prevents

Two exported components in one file. Both are then found by the name of the *file* rather than their own, so the second is invisible to a grep for where it is defined — the same searchability argument the `naming/` tag makes about barrels. It also means the file has two reasons to change.

Compound components namespaced under one export (`Object.assign(Card, { Header })`) are the sanctioned shape and stay silent. That exemption is what the check's own message recommends, so it has to hold: a rule whose remedy trips the rule teaches that the rule is noise.

## Why this is a script and not a lint rule

Not because of the counting: a per-file lint rule can accumulate exported components as it walks and decide at `Program:exit`. It is a script because the hard part is the component-declaration classifier, and that classifier is shared with [hook-count](hook-count.md) and [prop-count](prop-count.md) — written once, in `scripts/component-declarations.ts`. Those three move tiers together or not at all; splitting one off means two implementations of the same hard part, drifting.

## Where it applies

All `.tsx` files under `checks["react/single-component-export"].targetDirs`, excluding tests and barrels (`index.tsx`, which re-export by design).

## The two directions it fails in

Both are silent, which is why the fixtures name files for each.

**Under-matching.** `export function Name()`, `export default function`, a generic `export function Name<T>()`, an arrow assigned to a `const`, `memo(…)`, and `forwardRef(…)` are one thing to a reader and separate cases to every implementation. Cover the first and the rest are ignored without a word — and the ignored forms carry the smell, because the component tucked in beside another one is usually the small arrow, not the exported function declaration. A file the classifier can only half-read scores one component and reports nothing, which is indistinguishable from a file that was fine.

**Over-matching.** A PascalCase const is very often not a component. `export const AllComponentsCtx = createContext(…)` and `export const DRAG_SLOP = 4` both pass a name-only test, and reporting those trains people to ignore the rule, which costs more than the smell it was watching for. The shared classifier tests the bound **value** — an arrow, a function expression, `memo`, `forwardRef` — rather than the capital letter. This defect is invisible to every positive fixture; only the legal neighbour catches it.

## Adapt

`checks["react/single-component-export"].targetDirs` — globs relative to the source root naming where components live, defaulting to `features/*/ui`, `shared/ui`, `routes`. Globbed rather than listed because that set grows, and a hand-maintained list goes stale in silence. Share the value with `react/hook-count` and `react/prop-count`: three checks claiming to govern "the components" while walking different sets is worse than any one of them being wrong.

Nothing else is configurable. The declaration forms are not a per-project decision, and a project that spells them differently is changing the classifier for all three checks at once.

## Example output

```
WARN [single-component-export] src/features/chat/ui/panel.tsx — exports ChatPanel, EmptyState.
  Each is found by the name of this file rather than its own, so all but the
  first are invisible to a grep for where they are defined. Give each its own
  file, or namespace them under one export with Object.assign if they are
  genuinely a compound component.
```

## Why non-blocking

A genuine compound component is a real exception, and a hard limit here gets worked around — which teaches that rules are negotiable, and costs more than the smell. It reports and leaves the judgement in place.

## Fixtures

One exported **arrow-function** component beside an `export function`, one `export default function` beside one `export function`, and — the case a positive fixture is most likely to omit — a **generic** component beside an arrow one. These are the declaration forms a naive implementation misses, and each fixture must be a file that stays silent if its form goes unseen.

Two legal neighbours, because this rule fails in both directions: a compound component assembled with `Object.assign`, and a file exporting one component alongside a React context and an upper-case constant. An implementation that tested the exported *name* instead of the value bound to it reported both of those as components.
