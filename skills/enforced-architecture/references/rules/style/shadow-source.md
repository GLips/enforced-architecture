# style/shadow-source

| Field | Value |
|---|---|
| **Tag** | style |
| **Mechanism** | Structural script (all surfaces, pre-commit + CI) |
| **Blocking** | Yes |

## What it prevents

Elevation being invented at the call site. Every `box-shadow` / `boxShadow` / `shadowColor` / `elevation` in the codebase must live in one curated file; a component that needs a shadow applies the named one, and never hand-rolls the property.

## Why this is a script and not a lint rule

The property appears on surfaces the lint tier cannot reach. `box-shadow` in a `.css` or `.module.css` file is invisible to a JS/TS-AST plugin, and that is where shadows most often live. A single script covering stylesheets and TypeScript together is the only way to make the claim "every shadow is in one file" actually true.

## Where it applies

Every `.css`, `.ts`, and `.tsx` file under `src/` except the one allowed shadow file. Test files and generated files are excluded as usual.

## Algorithm

1. **Walk all stylesheet and source files** under `src/`.
2. **Skip the allowed file** — the curated shadow inventory.
3. **Blank out comments**, preserving newlines so line numbers stay true.
4. **Match the property by surface**: the CSS property spelling in stylesheets (`box-shadow`), the JS key spelling in TypeScript (`boxShadow`). On React Native, match the platform's elevation properties instead (see Configuration).
5. **Report every hit** with file and line.

## Configuration

```typescript
// The single curated home. One file, readable in one screen.
const ALLOWED = "src/shadows.css";

// Web: the CSS property in stylesheets, the JS key in TS/TSX.
const CSS_PATTERN = /\bbox-shadow\b/;
const JS_PATTERN = /\bboxShadow\b/;

// React Native: elevation is spelled differently and split across platforms.
// const RN_PATTERN = /\b(?:shadowColor|shadowOffset|shadowOpacity|shadowRadius|elevation)\b/;
```

**Adjustments:**

- **Pick the allowed home to match the styling system.** A CSS project gets `shadows.css`. A React Native project gets a `shadows.ts` exporting named style objects, and the patterns become the RN elevation properties — `shadowColor` / `shadowOffset` / `shadowOpacity` / `shadowRadius` on iOS, `elevation` on Android. The five-property spread is itself an argument for this rule: one elevation is five declarations, so five chances to be slightly different from the last one.
- **Decide the policy the inventory encodes, and write it at the top of the allowed file.** "No drop shadows; the only permitted shadows are border substitutes and the focus ring" is a strong default for a dense information UI. A marketing surface may want a real elevation scale. Either way the rule is the same — the file is the decision, and it is one file.
- **Do not add a `styles` / `sx` escape.** If shadows are permitted through a component's style prop, the inventory stops being an inventory.

## Example output

```
FAIL [shadow-source] src/features/scan/ui/result-card.tsx:31
  box-shadow outside src/shadows.css. Add a named class there (the curated
  shadow allowlist) and apply it via className; drop shadows are forbidden.

FAIL [shadow-source] src/features/scan/ui/panel.module.css:8
  box-shadow outside src/shadows.css. Add a named class there and apply it.
```

## Why blocking

The inventory claim is binary. One unreviewed shadow and "every shadow in this codebase is in one file" stops being true, which is the only thing this rule is protecting.
