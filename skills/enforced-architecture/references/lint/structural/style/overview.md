# style — Design-system adherence

The whole-tree half: three axes a per-file JS/TS rule cannot reach. `token-equality` needs the token
source itself — it *imports* the project's scales, which is the whole reason it is a structural
check rather than a lint rule. `css-tokens` and `shadow-source` need the stylesheet surface, which
oxlint does not parse.

The per-file half, and the argument for picking a tier before picking a rule, are in
[../../oxlint/style/overview.md](../../oxlint/style/overview.md).

| Rule | Blocking | What it buys |
|---|---|---|
| [token-equality](token-equality.ts) | Yes | Each call site that uses a spacing or radius token writes the token name, not the equal px number |
| [css-tokens](css-tokens.ts) | Yes | Every color and font-size value in a stylesheet is a token reference or a token definition |
| [shadow-source](shadow-source.ts) | Yes | Only one file declares a shadow: the file that `allowedFile` names |

Take `css-tokens` if the project has stylesheet files. If all style is in TypeScript — React Native,
StyleX, vanilla-extract, styled-components with typed themes — skip it. The lint tier already reads
that full surface, and `style/no-inline-color` matches a `StyleSheet.create` body with no change.
`css-tokens` reads color and font-size only, so a project that takes it alone leaves `box-shadow` to
`shadow-source` and spacing to `token-equality`.

`shadow-source` makes sure of a location and not a policy. Write the permitted shadow policy at the
top of `allowedFile`; if you do not, the list grows by one entry for each request. It covers the
stylesheet surface and the TS/TSX surface together. The oxlint tier cannot read a `.css` file, so no
per-file lint rule replaces it.

`token-equality` reports nothing until the project config file imports its theme module and gives
`spacingScale` and `radiusScale`. The default scales are empty. On React Native or Unistyles, the
style-object surfaces (`padding: 16` in a `StyleSheet.create` call) work with no change. The JSX
prop surfaces apply only if your primitives take spacing props; if they do not, set `spacingProps`
and `radiusProps` empty.

Adoption mechanics, the spec contract, and what part of the tree owns each rule's subject: [../../overview.md](../../overview.md).
