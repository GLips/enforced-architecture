# react/single-component-export

| Field | Value |
|---|---|
| **Tag** | react |
| **Mechanism** | Structural script (per-file counting, pre-commit + CI) |
| **Blocking** | No (warning only) |

## What it prevents

Two exported components in one file. Both are then found by the name of the *file* rather than their own, so the second is invisible to a grep for where it is defined — the same searchability argument the `naming/` tag makes about barrels. It also means the file has two reasons to change.

Compound components namespaced under one export (`Object.assign(Card, { Header })`) are fine and should not fire.

## Why this is a script and not GritQL

Counting is the whole job, and GritQL cannot count within a file. A pattern can match an exported component; it cannot tell you there were two.

The second reason is that a component has too many declaration forms for one pattern to cover. `export function Name()`, `export default function`, an arrow assigned to a `const`, `memo(…)`, `forwardRef(…)`, and a declaration exported on a later line are one thing to a reader and different nodes to a matcher. A pattern written for the first form silently ignores the rest — and the forms it ignores carry the smell, because the component tucked in beside another one is usually the small arrow, not the exported function declaration.

## Where it applies

All `.tsx` files in the component tree, excluding tests and barrels (`index.tsx`).

## Algorithm

Shares its file walk and comment-blanking with [hook-count](hook-count.md) and [prop-count](prop-count.md) — implement all three in one script, since they read the same files and answer the same kind of question.

1. **Blank comments** rather than stripping them, so line numbers stay true and a component name mentioned in prose cannot be counted.
2. **Collect exported component declarations** — both `export [default] function Name(` and `export const Name = (` / `= function`, PascalCase only.
3. **Report when a file yields more than one name**, listing them.

## Configuration

```typescript
const EXPORTED_COMPONENT = /^\s*export\s+(?:default\s+)?function\s+([A-Z]\w*)\s*\(/;

// The const form must test the VALUE, not just the name.
const EXPORTED_ARROW_COMPONENT =
  /^\s*export\s+const\s+([A-Z][a-zA-Z0-9]*)\s*(?::[^=]+)?=\s*(?:\(|function\b|forwardRef|memo\b|React\.memo\b)/;
```

Both forms are required. A script handling only the `function` declaration reproduces the GritQL rule's blind spot in a new language.

**Test the value, not just the name.** A PascalCase or upper-case `const` is very often not a component — `export const AllComponentsCtx = createContext(…)` and `export const DRAG_SLOP = 4` both pass a name-only test. Reporting those trains people to ignore the rule, which costs more than the smell it was watching for. This over-matching is invisible to every positive fixture; only the legal neighbour catches it.

## Example output

```
WARN [single-component-export] src/features/chat/ui/panel.tsx — exports ChatPanel, EmptyState.
  Both are found by the name of this file rather than their own, so the second is
  invisible to a grep for where it is defined. Give it its own file, or namespace the
  pair under one export if they are genuinely a compound component.
```

## Why non-blocking

A genuine compound component is a real exception, and a hard limit here gets worked around — which teaches that rules are negotiable, and costs more than the smell. It reports and leaves the judgement in place.

## Fixtures

Two exported **arrow-function** components in one file, and one `export default function` beside one `export function` — the declaration forms a naive implementation misses.

Two legal neighbours, because this rule fails in both directions: a compound component assembled with `Object.assign`, and a file exporting one component alongside a React context and an upper-case constant. An implementation that tested the exported *name* instead of the value bound to it reported both of those as components.
