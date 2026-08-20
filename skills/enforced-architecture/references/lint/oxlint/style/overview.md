# style — Design-system adherence

Styling is where generated code drifts hardest and least visibly. A model reaches for a plausible gray, a raw `fontSize`, a `16px` where `"md"` was meant — each one defensible on its own, none of them canonically yours, and across enough generations the interface quietly stops matching itself. A design doc does not stop this: anything written in prose is a probability the model weighs against everything else in its context, not a guarantee. These rules make off-system styling *hard to express* rather than discouraged.

## Pick the tier before picking the rule

Enforcement runs in three tiers, and choosing the right one per axis is most of the work:

1. **Types** — closed props on your own primitives (a `tone`, not an open `color`; a `size` from a small union). The wrong value does not compile. This is the strongest tier and the cheapest; put every axis here that will fit. It is also the answer for "the variant value must come from the token union" — that is a type-system job, not a lint job.
2. **oxlint rules** — the escape hatches types leave open (component libraries that also accept any string, inline style objects, `className`). Per-file, real-time, JS/TS AST only.
3. **Structural checks** — anything needing the token source, cross-file knowledge, or the CSS surface, none of which a per-file JS/TS rule can reach.

The per-file half is below; the axes needing the token source, cross-file knowledge, or the CSS
surface are in [../../structural/style/overview.md](../../structural/style/overview.md).

Every rule below keys off two project facts: where the primitives layer lives (what the rules exempt) and which module owns each closed scale (what `token-equality` imports). Settle both before adapting anything here. If there is no design system yet, this tag is a later phase rather than a rule set to adapt now.

| Rule | Blocking | What it prevents |
|---|---|---|
| [no-raw-primitives](no-raw-primitives.ts) | Yes | Feature code using raw `<div>`/`<span>` (web) or `View`/`Text` from `react-native`, instead of composing the design system's primitives |
| [no-inline-color](no-inline-color.ts) | Yes | Raw hex / `rgb()` / `hsl()` values in style objects and color props (breaks light/dark, which tokens hold together) |
| [no-inline-font-size](no-inline-font-size.ts) | Yes | Raw `fontSize` overrides instead of a named size from the type scale |
| [no-inline-style-prop](no-inline-style-prop.ts) | Yes | Inline `style={{…}}` objects outside the primitives layer (strictest rule in the tag — see its Adapt section before taking it) |
| [no-arbitrary-class-values](no-arbitrary-class-values.ts) | Yes | Utility classes carrying raw values (`text-[13px]`, `bg-[#fff]`) or the framework's generic scale (`text-sm`) instead of semantic tokens |
| [vendor-component-containment](vendor-component-containment.ts) | Yes | Importing a UI-library component directly when the project ships a wrapper that carries a shared convention |

Adoption mechanics, the spec contract, and cross-tag rule selection: [../../overview.md](../../overview.md).
