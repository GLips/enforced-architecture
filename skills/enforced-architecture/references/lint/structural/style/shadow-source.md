# style/shadow-source

| Field | Value |
|---|---|
| **Tag** | style |
| **Mechanism** | Structural check (all surfaces, pre-commit + CI) |
| **Blocking** | Yes |

## What it prevents

Elevation being invented at the call site. Every shadow in the codebase lives in one curated file; a component that needs one applies the named entry and never hand-rolls the property.

The value of the rule is not that any individual shadow is wrong — it is that the file *is* the inventory. "Every shadow in this codebase is in one screen" is a claim a reviewer can act on: they can read the whole elevation vocabulary in thirty seconds, and a new entry is a visible diff against a small file rather than one more `0 1px 3px rgba(0,0,0,.12)` indistinguishable from the four already scattered around.

## Why this is a script and not a lint rule

The property appears on surfaces the lint tier cannot reach. `box-shadow` in a `.css` or `.module.css` file is invisible to a JS/TS-AST plugin, and that is where shadows most often live — a lint rule covering the TSX half certifies the half where the problem is not. One script covering stylesheets and TypeScript together is the only way to make the claim actually true.

The two surfaces are matched by *different patterns*, chosen by extension: the CSS property spelling (`stylesheetPattern`) in stylesheets, the JS key spelling (`scriptPattern`) in TS/TSX. They are separate branches, so a case exercising one proves nothing about the other, and the branch that goes unexercised is the one that quietly stops matching.

## Where it applies

Every file under the source roots whose extension is in `scannedExtensions`, minus the global exclusions (tests, generated files, declarations) and minus `allowedFile` itself.

Comments are blanked, not stripped, before matching — spaces in, newlines kept — so the reported line is the line on disk. This matters more here than it looks: the property is discussed in prose constantly (`/* no box-shadow here — see shadows.css */`), and a check matching raw text fails the commit on the comment telling people about the rule.

## Negative space

**It does not read the shadow's value.** Whether an entry in the allowed file is a good shadow is a design question, not a mechanical one. This rule only answers *where*.

**It does not police the inverse.** An unused entry in the allowed file is not reported. The inventory is allowed to be slightly larger than what is currently applied; it is not allowed to be incomplete.

**One finding per line, not per occurrence.** Two shadows on one line is one report, and the fix for both is the same move.

**Do not add a `styles` / `sx` escape.** The pressure to exempt a component's style prop arrives about a week in, and it is the one adjustment that ends the rule: if shadows are permitted through a prop, the inventory stops being an inventory and the claim it protects is no longer checkable by reading one file.

## Adapt

Four knobs, all under `checks["style/shadow-source"]`:

- **`allowedFile`** — the single curated home, source-root-relative. Pick it to match the styling system: a CSS project gets `shadows.css`, a React Native project a `shadows.ts` exporting named style objects.
- **`scannedExtensions`** — what gets read. Stylesheets *and* TypeScript together is the point; a project shipping `.scss` or `.module.css` adds those spellings here.
- **`stylesheetPattern`** / **`scriptPattern`** — the property spelling per surface. On React Native, swap `scriptPattern`: elevation there is five properties split across platforms — `shadowColor`, `shadowOffset`, `shadowOpacity`, `shadowRadius` on iOS, `elevation` on Android — so the pattern becomes an alternation of the five and `allowedFile` points at the `shadows.ts`. The five-property spread is itself an argument for the rule: one elevation is five declarations, so five chances to be slightly different from the last one.

Both patterns are anchored on word boundaries, and that is load-bearing rather than tidy. `shadowRoot`, a `data-shadow` attribute and a `.shadow-panel` class name are all correct code, and a blocking check that fails a commit on them is the check people route around.

**Decide the policy the inventory encodes, and write it at the top of the allowed file.** "No drop shadows; the only permitted shadows are border substitutes and the focus ring" is a strong default for a dense information UI. A marketing surface may want a real elevation scale. Either way the mechanism is the same — the file is the decision, and it is one file. Without that header the rule enforces a location and no intent, and the inventory grows by one entry per request.

## Implementation

[`shadow-source.ts`](./shadow-source.ts). Walks the source roots, skips `allowedFile`, blanks comments, and reports the matched spelling with its line. The message names the spelling that fired, which is what makes a React Native finding legible — "which of the five" is the first thing the reader wants.

## Example output

```
FAIL [style/shadow-source] src/features/scan/ui/panel.module.css:8
  box-shadow outside shadows.css.
  Add a named entry to that file — the curated shadow inventory — and apply it
  by name instead of writing the property here. The claim this protects is
  binary: one unreviewed shadow anywhere else and "every shadow in this
  codebase is in one file" stops being true.

FAIL [style/shadow-source] src/features/scan/ui/result-card.tsx:31
  boxShadow outside shadows.css.
  …
```

## Why blocking

The inventory claim is binary. One unreviewed shadow and "every shadow in this codebase is in one file" stops being true, which is the only thing this rule protects. A warning tier would be worse than nothing here: the violations accumulate, the claim quietly stops holding, and the file everyone still points at is no longer the inventory it says it is.

## Fixtures

Two violations, one per surface, because the branches are independent: a `box-shadow` in a stylesheet (the obvious case) and a `boxShadow` in a TSX inline style (the adversarial one — a CSS-only implementation is silent on it while looking entirely correct against the first). Both carry the property in their comment headers too, so a check matching raw text reports each twice and the multiset count says so.

The stylesheet fixture uses a `var()` in its shadow value deliberately: a raw `rgba()` there would also trip `style/css-tokens`, and the two findings would mask each other.

The legal neighbours: the curated allowlist itself, which holds a real `box-shadow` and is the only proof that the skip works, and a component using `shadowRoot`, `data-shadow` and a `shadow-panel` class — the word in three places that are not the property.
