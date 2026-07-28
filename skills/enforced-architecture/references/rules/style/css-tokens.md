# style/css-tokens

| Field | Value |
|---|---|
| **Tag** | style |
| **Mechanism** | Structural script (scans stylesheets, pre-commit + CI) |
| **Blocking** | Yes |

## What it prevents

Raw color and font-size values in stylesheets — `color: #0a0c10`, `font-size: 13px` — in `.css`, `.module.css`, or whatever stylesheet dialect the project uses.

## Why this exists as a separate rule

It is the stylesheet mirror of `style/no-inline-color` and `style/no-inline-font-size`, and it exists for one blunt reason: **Biome's GritQL plugins run on the JavaScript/TypeScript AST only.** They cannot see a `.css` file at all. Without this check, a project can have both GritQL rules passing, a green pipeline, and a `font-size: 13px` sitting in a CSS module — the exact drift the tag was built to stop, in the one surface the tag could not look at.

Take this rule if the project has any stylesheet files. Skip it if all styling is expressed in TypeScript (React Native, StyleX, vanilla-extract, styled-components with typed themes) — there, the GritQL rules already cover the whole surface, and the object-literal patterns in `style/no-inline-color` catch `StyleSheet.create` bodies unchanged.

## Where it applies

All stylesheet files under `src/`, excluding:

- **Token-source stylesheets.** The file holding the `--color-*` / `--text-*` definitions must assign raw values — that is what a token definition is.
- Generated files.

## Algorithm

1. **Walk stylesheet files** under `src/`, applying the exclusions above.
2. **Blank out block comments**, preserving newlines so reported line numbers stay true.
3. **Skip custom-property definition lines.** Any line whose property name starts with `--` is a token declaration and must carry a raw value. Skipping these by *shape* rather than by file makes the check robust if a token ever moves out of the token file. A `var(--x)` **reference** is a value, not a declaration, so it does not start the line and is not skipped.
4. **Flag raw colors** — a hex literal (`#rgb` / `#rrggbb` / `#rrggbbaa`) or a `rgb()` / `rgba()` / `hsl()` / `hsla()` call with a literal channel. Requiring a literal digit inside the function is what lets `rgb(var(--brand-channels))` pass.
5. **Flag raw font sizes** — a `font-size:` declaration whose value carries an absolute length literal (`px`, `rem`, `pt`).

## Configuration

```typescript
// Token-source stylesheets define the raw values by design.
const EXEMPT_FILES = new Set(["src/styles.css"]);

const RAW_COLOR = /#[0-9a-fA-F]{3,8}\b|(?:rgb|rgba|hsl|hsla)\([^)]*[0-9]/;
const RAW_FONT_SIZE = /\bfont-size\s*:\s*[^;{}]*\b[\d.]+(?:px|rem|pt)\b/;
const CUSTOM_PROP_DEF = /^\s*--[\w-]+\s*:/;
```

**Adjustments:**

- **`em` and `%` are deliberately not matched** on font-size. They are relative units, and an absolute type scale cannot express "1.3× the surrounding text" — so there is no unambiguous token to suggest, and a rule with no fix to offer is a rule agents learn to route around. This is the same restraint `style/token-equality` applies to off-scale values. It is what lets a markdown renderer's relative heading scaling pass while a real `font-size: 13px` anywhere is still caught.
- **Scope is color and font-size only.** `box-shadow` belongs to `style/shadow-source`; leaving it out here avoids two diagnostics for one violation. Resist adding spacing — `token-equality` owns that axis and owns it better, because it reads the actual scale.

## Example output

```
FAIL [css-tokens] src/features/scan/ui/result-card.module.css:12
  Raw color value in CSS. Use a color token via var(--color-text-secondary) so
  light and dark stay in sync.

FAIL [css-tokens] src/features/scan/ui/result-card.module.css:19
  Raw font-size in CSS. Use the type scale via var(--text-body) so it stays on
  the scale defined in src/styles.css.
```

## Why blocking

Same reasoning as its two GritQL siblings: the fix is naming a token that already exists. A non-blocking version would train agents to treat every rule in the tag as advisory, and the tag only works as an absolute.
