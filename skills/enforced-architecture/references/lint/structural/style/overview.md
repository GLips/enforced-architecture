# style — Design-system adherence

The whole-tree half: three axes a per-file JS/TS rule cannot reach. `token-equality` needs the token
source itself — it *imports* the project's scales, which is the whole reason it is a structural
check rather than a lint rule. `css-tokens` and `shadow-source` need the stylesheet surface, which
oxlint does not parse.

The per-file half, and the argument for picking a tier before picking a rule, are in
[../../oxlint/style/overview.md](../../oxlint/style/overview.md).

| Rule | Blocking | What it prevents |
|---|---|---|
| [token-equality](token-equality.md) | Yes | Raw values that exactly equal a named token (`gap={16}` when that IS `"md"`). Off-scale one-offs pass deliberately |
| [css-tokens](css-tokens.md) | Yes | Raw color and font-size in stylesheets — the surface a JS/TS lint rule cannot see |
| [shadow-source](shadow-source.md) | Yes | `box-shadow` / elevation outside the one curated shadow file |

Adoption mechanics, the spec contract, and cross-tag rule selection: [../../overview.md](../../overview.md).
