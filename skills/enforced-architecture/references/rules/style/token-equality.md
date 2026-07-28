# style/token-equality

| Field | Value |
|---|---|
| **Tag** | style |
| **Mechanism** | Structural script (imports the token source, pre-commit + CI) |
| **Blocking** | Yes |

## What it prevents

Hand-writing a raw value that the design system already names. `gap={16}` when `gap="md"` means exactly that. `borderRadius: 2` when `2` *is* `xs`. `padding: 8` when `8` *is* `s`.

These are the drift that survives every other rule in the tag. They are not off-brand — the value is right — so nothing looks wrong at the call site. But the codebase now has two spellings for one decision, and only one of them moves when the scale moves. Change `md` from 16px to 14px and every `gap="md"` follows while every `gap={16}` silently stays behind, at which point the interface is subtly, permanently inconsistent and no one can point at the commit that did it.

## The narrow claim (read this before widening the rule)

**This rule fires only when a raw value exactly equals a token on the relevant closed scale.** It does not ban raw dimensions generally.

That restraint is the whole design, and it is the hard-won part. A lint rule cannot tell a deliberate one-off (`w={360}` — a sidebar that is 360px because that is what looks right) from drift. A project that tries to ban all raw dimensions gets two bad outcomes:

- **Ceremony fixes.** The agent renames the magic number: `const PANEL_WIDTH = 360`. The linter is satisfied, nothing was learned, and the codebase gained a constant that means nothing to anyone.
- **A duplicated scale.** Expressing "is this on the scale?" in a per-file linter means hardcoding the px→token map into the rule, so the enforcer now holds its own copy of the design system and drifts from it.

So: token-equal values are errors, because the fix is unambiguous and mechanical. Off-scale values (`gap={6}`, `h={37}`) pass silently, because a rule that guesses there is worse than no rule. If an off-scale value recurs, the answer is a component that owns that dimension — not a hoisted constant, and not a broader lint.

## Why this is a script and not a GritQL rule

Because it must **import the token source**. The script reads `spacing` and `radius` from the project's theme module and builds its px→token maps from them at run time, so the enforcer cannot fall out of sync with the scale it guards. A per-file linter cannot import the theme; that is precisely why this axis lives at the structural tier.

This is the general test for tier placement in this tag: if the check needs the token source, cross-file knowledge, or the CSS surface, it is a script. If it can be decided from one file's AST, it is GritQL.

## Where it applies

All `src/**/*.ts` and `src/**/*.tsx`, excluding:

- The token source itself (it defines the scale)
- Test files, generated files, scripts
- Non-UI layers that carry no styling (`src/domains/`)
- Documented render boundaries (the root document, canvas-backed widgets)

## Algorithm

1. **Build the maps.** Import the spacing and radius scales from the theme module. Convert each token's value to px (`rem` × 16 at the browser default). **Drop zero** — `none` / `0px` collapses to 0, and 0 is a no-op the rule must stay silent on, never a token to enforce.
2. **Walk source files**, applying the exclusions above.
3. **Blank out comments**, replacing their contents with spaces so line numbers stay true. A token-equal number mentioned in prose then cannot false-positive.
4. **Scan each line** against four surface patterns:

   | Surface | Shape | Scale |
   |---|---|---|
   | Spacing props | `gap={16}`, `p="8"`, `mt={12}` | spacing |
   | Radius prop | `radius={6}` | radius |
   | Style-object spacing keys | `padding: 16`, `rowGap: 8` | spacing |
   | Style-object radius keys | `borderRadius: 6` | radius |

5. **Report only exact hits.** Look the extracted px up in the map. No entry means off-scale — stay silent.

## Configuration

```typescript
// The two scales come from the theme — never restate them here.
import { radius, spacing } from "../src/shared/ui/theme.ts";

// Surfaces. Extend to match the props your primitives actually expose.
const SPACING_PROPS = "gap|p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml";
const SPACING_KEYS =
  "padding|paddingTop|paddingRight|paddingBottom|paddingLeft|paddingInline|paddingBlock|" +
  "margin|marginTop|marginRight|marginBottom|marginLeft|marginInline|marginBlock|gap|rowGap|columnGap";
const RADIUS_KEYS =
  "borderRadius|borderTopLeftRadius|borderTopRightRadius|borderBottomLeftRadius|borderBottomRightRadius";
```

**Adjustments:**

- **Scale import path** is the one thing every project must change. If the scales live in more than one module (spacing in a theme, radius in a CSS file), import each from where it actually lives rather than copying values across.
- **React Native / Unistyles:** the style-object surfaces are the same shape (`padding: 16` in a `StyleSheet.create` call is identical to an inline style object), so those two patterns work unchanged. The JSX-prop surfaces apply only if your primitives take spacing props — if they do not, drop those two patterns rather than leaving dead regexes in the file.
- **No inline suppression.** Do not add an ignore-comment convention. A token-equal raw value is virtually always the token spelled wrong; a genuine exception is a signal to revisit the scale, not to silence the check.

## Example output

```
FAIL [token-equality] src/features/scan/ui/result-card.tsx:24
  This is a named spacing token (4=xs, 8=s, 12=m, 16=l, 24=xl).
  Use the token (gap="l") instead of the raw px (gap={16}) so spacing can't
  drift off-scale. Off-scale values are fine raw.

FAIL [token-equality] src/features/scan/ui/badge.tsx:11
  This is a named radius token (2=xs, 4=s, 8=m).
  Use radius="xs" (or var(--radius-xs)) instead of the raw px (borderRadius: 2).
  borderRadius: "50%" for a circle is fine.
```

## Why blocking

The fix is mechanical and unambiguous — the message names the exact token to use. There is no judgment call to defer to a human, so there is nothing for a warning to buy.
