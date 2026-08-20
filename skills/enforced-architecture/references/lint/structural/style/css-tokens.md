# style/css-tokens

| Field | Value |
|---|---|
| **Tag** | style |
| **Mechanism** | Structural script (scans stylesheets, pre-commit + CI) |
| **Blocking** | Yes |

## What it prevents

Raw color and font-size values in stylesheets — `color: #0a0c10`, `font-size: 13px` — in `.css`, `.module.css`, or whatever stylesheet dialect the project ships.

## Why this is a script and not a lint rule

It is the stylesheet mirror of `style/no-inline-color` and `style/no-inline-font-size`, and it exists for one blunt reason: **oxlint's JS plugins run on the JavaScript/TypeScript AST only.** They cannot see a `.css` file at all — not "parse it badly", not "miss some of it": the file never reaches them.

So without this check a project has both lint rules passing, a green pipeline, and a `font-size: 13px` sitting in a CSS module. That is the exact drift the tag was built to stop, in the one surface the tag could not look at, and it is invisible from inside the lint tier — the rules that own color and type report cleanly because they were never handed the file.

Take this rule if the project has any stylesheet files. Skip it if all styling is expressed in TypeScript (React Native, StyleX, vanilla-extract, styled-components with typed themes) — there the lint rules already cover the whole surface, and the object-literal patterns in `style/no-inline-color` catch `StyleSheet.create` bodies unchanged.

## Where it applies

Every stylesheet under the configured source roots. Two things are outside it, and each is a false positive if the general case handles it:

- **Token-source stylesheets**, exempt whole by path. The file holding the `--color-*` / `--text-*` definitions must assign raw values — that is what a token definition is — and a global stylesheet also carries base rules (`body { color: … }`) that are raw values by the same right.
- **Custom-property definitions anywhere**, skipped by *shape* rather than by file. A token declaration must assign a raw value wherever it lives, so skipping by shape keeps the check right if a token ever moves out of the token file. A `var(--x)` **reference** is a value, not a declaration, and is never skipped.

The unit of matching is the **declaration**, not the line. A value wrapped onto the line after its property is invisible to a line-oriented matcher, which sees a property with no unit and then a unit with no property — the same defect that let `react/prop-count` see a third of one repo's components while looking green.

## Negative space

**`em` and `%` are not matched on font-size.** They are relative units, and an absolute type scale cannot express "1.3× the surrounding text" — so there is no unambiguous token to suggest, and a rule with no fix to offer is one agents learn to route around. This is the same restraint `style/token-equality` applies to off-scale values. It is what lets a markdown renderer's relative heading scaling pass while a real `font-size: 13px` anywhere is still caught.

**A color function with a token channel is silent.** `rgb(var(--brand-channels))` carries no literal digit inside the parens, and requiring one is what separates a hand-written channel from a token reference. Dropping that requirement turns every channel-based token into a finding, which is the over-match that trains people to switch a check off.

**`box-shadow` is not in scope.** It belongs to `style/shadow-source`; leaving it out here means one violation produces one diagnostic rather than two.

**Spacing is not in scope either.** `style/token-equality` owns that axis and owns it better, because it reads the project's actual scale instead of guessing which lengths are on it. Resist adding it here — a check that compares against a scale it does not hold is a check that drifts from the scale silently.

## Adapt

Two knobs, under `checks["style/css-tokens"]`:

- **`stylesheetExtensions`** — the dialects walked, without the dot. Add `scss` / `less` / `pcss` for a project that ships them; the matchers are property-and-value shapes and carry over unchanged.
- **`exemptFiles`** — source-root-relative token sources. Keep this list to the files that genuinely *define* the scales. It is not an escape hatch for a stylesheet that has raw values in it, and there is deliberately no per-line suppression: a value that cannot be tokenised is a gap in the scale, which is a conversation about the scale rather than about this file.

Everything else is `source.roots` and the shared exclusions.

The matchers themselves live in the [implementation](css-tokens.ts) rather than here, so there is one home for them and no second copy to drift.

## Example output

```
FAIL [style/css-tokens] src/features/scan/ui/result-card.module.css:12
  Raw color value in CSS: #0a0c10.
  Reference a color token — `color: var(--color-text-secondary)` — so light
  and dark stay in sync. The lint tier enforces this on the JS/TS surface and
  cannot read this file, so a raw value here is the one that survives review.

FAIL [style/css-tokens] src/features/scan/ui/result-card.module.css:19
  Raw font-size in CSS.
  Reference the type scale — `font-size: var(--text-body)` — so the size stays
  on the scale the token source defines. Relative units (`em`, `%`) are left
  alone on purpose: no absolute token can express them.
```

## Fixtures

A raw color and a raw font-size in **two** files: held together, either matcher alone kept the file reporting, so breaking the color regex left the suite green.

The adversarial case is a `font-size` whose value sits on the line after the property — silent to the line-oriented shape this check naturally takes — with a `rgb(var(--x))` beside it that has to stay quiet, so a color matcher that stops requiring a literal channel shows up as a second finding on the same file.

The legal neighbours: one stylesheet silent through three separate exemptions (a `var()` reference, a `--custom-prop` definition, a relative `em`), the token source, and the shadow allowlist — which this rule does not exempt and does not need to, since its channels are tokens.

## Why blocking

Same reasoning as its two lint-tier siblings: the fix is naming a token that already exists. A non-blocking version would train agents to treat every rule in the tag as advisory, and the tag only works as an absolute.
