# style — Design-system adherence

The whole-tree half: three axes a per-file JS/TS rule cannot reach. `token-equality` needs the token
source itself — it is handed the project's own scales, which is the whole reason it is a structural
check rather than a lint rule. `css-tokens` and `shadow-source` need the stylesheet surface, which
oxlint does not parse.

The per-file half, and the argument for picking a tier before picking a rule, are in
[../../oxlint/style/overview.md](../../oxlint/style/overview.md).

| Rule | Blocking | What it buys |
|---|---|---|
| [token-equality](token-equality.ts) | Yes | Each call site that uses a spacing or radius token writes the token name, not the equal px number |
| [css-tokens](css-tokens.ts) | Yes | Every color and font-size value in a stylesheet is a token reference or a token definition |
| [shadow-source](shadow-source.ts) | Yes | Only one file declares a shadow: the file that `allowedFile` names |

`css-tokens` has a subject only where the project has stylesheet files. Where all style is in
TypeScript — React Native, StyleX, vanilla-extract, styled-components with typed themes — it finds
nothing and stays silent, which is the rule working rather than a reason to drop it: the day the tree
grows its first `.css` file the fence is already standing. The oxlint tier covers the TypeScript
surface meanwhile, and `style/no-inline-color` matches a `StyleSheet.create` body with no change.
`css-tokens` reads color and font-size only, so `box-shadow` belongs to `shadow-source` and spacing
to `token-equality`.

`shadow-source` makes sure of a location and not a policy. Write the permitted shadow policy at the
top of `allowedFile`; if you do not, the list grows by one entry for each request. It covers the
stylesheet surface and the TS/TSX surface together. The oxlint tier cannot read a `.css` file, so no
per-file lint rule replaces it.

`token-equality` compares against `spacingScale` and `radiusScale`, and the config has to build both
from the project's theme module. On React Native or Unistyles the style-object surfaces
(`padding: 16` in a `StyleSheet.create` call) work with no change.

**Read the scales out of the theme module's source; do not import it.** Use
`readThemeScaleFromSource` from [../theme-scale.ts](../theme-scale.ts). An import is the shape that
suggests itself, and it only works where the theme module is plain constants. Every compile-time
token system — StyleX, vanilla-extract, Panda — defines its tokens as an input to a Babel or bundler
pass rather than as a module with a runtime, and StyleX is the worst case of the three:
`stylex.defineVars` is a function whose body throws, as are `create`, `createTheme` and
`defineConsts`, so there is no non-throwing entry point. An `arch.config.ts` that imports a
`.stylex.ts` theme does not get bad scales, it takes the entire structural tier down at config load,
before `assertGoverningConfig` runs. Compiling first does not help either: post-Babel the values are
`var(--x…)` references, not lengths. The literals in the source are the only form of a scale that
every one of these systems holds.

**An empty scale is refused, at both ends.** `assertGoverningConfig` throws on an empty
`spacingScale` or `radiusScale` before any check runs, and `readThemeScaleFromSource` throws on a
theme module it can read only part of — a renamed export, a moved file, one token spelled as an
expression. Both refusals exist because the alternative is this check's worst state: every style
surface walked, nothing reported, and nothing in the config reading as off.

**Do not empty one of the four name lists.** `assertGoverningConfig` throws on an empty
`spacingProps`, `radiusProps`, `spacingStyleKeys` or `radiusStyleKeys`, before any check runs, and
the throw takes the whole structural tier down rather than that one surface. Emptying a list was how
a review once took this check from four findings to zero with nothing in the config reading as off.
If the project's primitives take no spacing props, name the props they do take; the lists are
identifier allowlists, so an entry that matches nothing costs nothing.

Adoption mechanics, the spec contract, and what part of the tree owns each rule's subject: [../../overview.md](../../overview.md).
