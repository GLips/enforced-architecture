# style/token-equality

| Field | Value |
|---|---|
| **Tag** | style |
| **Mechanism** | Structural check (reads the project's token source, pre-commit + CI) |
| **Blocking** | Yes |

## What it prevents

Hand-writing a raw value that the design system already names. `gap={16}` when `gap="md"` means exactly that. `borderRadius: 2` when `2` *is* `xs`. `padding: 8` when `8` *is* `s`.

This is the drift that survives every other rule in the tag. It is not off-brand — the value is right — so nothing reads as wrong at the call site. But the codebase now holds two spellings for one decision, and only one of them moves when the scale moves. Change `md` from 16px to 14px and every `gap="md"` follows while every `gap={16}` silently stays behind, at which point the interface is subtly, permanently inconsistent and nobody can point at the commit that did it.

## The narrow claim (read this before widening the rule)

**This rule fires only when a raw value exactly equals a token on the relevant closed scale.** It does not ban raw dimensions generally.

That restraint is the whole design, and it is the hard-won part. A lint rule cannot tell a deliberate one-off (`w={360}` — a sidebar that is 360px because that is what looks right) from drift. A project that tries to ban all raw dimensions gets two bad outcomes:

- **Ceremony fixes.** The agent renames the magic number: `const PANEL_WIDTH = 360`. The linter is satisfied, nothing was learned, and the codebase gained a constant that means nothing to anyone.
- **A duplicated scale.** Expressing "is this on the scale?" in a per-file linter means hardcoding the px→token map into the rule, so the enforcer now holds its own copy of the design system and drifts from it.

So: token-equal values are errors, because the fix is unambiguous and mechanical. Off-scale values (`gap={6}`, `h={37}`) pass silently, because a rule that guesses there is worse than no rule. If an off-scale value recurs, the answer is a component that owns that dimension — not a hoisted constant, and not a broader lint.

## Why this is a script and not a lint rule

Because it must **import the token source**. The scales arrive through `config`, which the project's config file fills in by importing its theme module, and the check builds its px→token maps from them at run time — so the enforcer cannot fall out of sync with the scale it guards. A per-file lint rule cannot import the theme. That is precisely why this axis lives at the structural tier.

This is the general test for tier placement in this tag: if the check needs the token source, cross-file knowledge, or the CSS surface, it is a script. If it can be decided from one file's AST, it is a lint rule.

## Where it applies

Every `.ts` and `.tsx` file under the **source root**, minus `source.exclude` (tests, generated files, declaration files) and minus this check's own `exemptPaths`. Four surfaces are read, and each one is a separate matcher:

| Surface | Shape | Scale |
|---|---|---|
| Spacing props | `gap={16}`, `p="8"`, `mt="12px"` | spacing |
| Radius prop | `radius={6}`, `radius="6px"` | radius |
| Style-object spacing keys | `padding: 16`, `rowGap: 8` | spacing |
| Style-object radius keys | `borderRadius: 6` | radius |

Fixing one matcher while another has quietly stopped matching is the failure this tier keeps producing, so all four have their own fixture — one file that must report exactly four times.

## Negative space

**Zero is never a token.** `none` / `0px` collapses to 0 and is dropped when the px maps are built. Rewriting `gap={0}` to a token name would be wrong: 0 is a no-op, not a spacing decision. An off-scale neighbour carries `radius={0}` for exactly this reason.

**Off-scale numbers are silent**, which is the narrow claim above and not a gap in coverage. So are `var(--*)` references and shape values like `borderRadius: "50%"` — neither carries a token-equal bare px.

**An empty scale means the check has nothing to compare against and stays silent.** That is the default in `defaultCheckConfigs`, and it is correct: a project that has not pointed the check at its theme has not adopted it. It is also why adoption is checked by seeing a finding, never by seeing a clean run.

**Numbers in comments do not count.** Comments are blanked to spaces — with newlines kept, so reported line numbers stay true — before anything is matched. The file documenting this rule quotes the violation verbatim, and a check that reads its own documentation as a violation fails the commit that documents it.

**No inline suppression.** Do not add an ignore-comment convention. A token-equal raw value is virtually always the token spelled wrong; a genuine exception is a signal to revisit the scale, not to silence the check.

## Adapt

Every knob is `config.checks["style/token-equality"]`:

- **`spacingScale` / `radiusScale`** — the one thing every project must supply, and the only correct way to supply it is by importing the theme module in the config file. `harness/structural-fixtures/config.ts` is the worked example: it imports `spacing` and `radius` from the tree's own `shared/ui/theme.ts`. Never restate a scale in the config — a copied scale is the duplicated-scale failure with an extra step. If the two scales live in different modules (spacing in a theme, radius in a CSS-adjacent module), import each from where it actually lives.
- **`spacingProps` / `radiusProps`** — the JSX props your primitives actually expose. The defaults are the Mantine-shaped set (`gap`, `p`, `px`…, `radius`); a design system with different prop names replaces the list rather than adding to it.
- **`spacingKeys` / `radiusKeys`** — the style-object keys, in their JS spelling. Values are read as px numbers, so `padding: "16px"` in a style object is not a subject; the string surface that is read is the JSX prop value.
- **`exemptPaths`** — regexes tested against the **source-root-relative** path. The token source itself belongs here (it defines the raw values, which is what a token declaration is), along with layers that carry no styling (`domains/` by default) and documented render boundaries such as a root document or a canvas-backed widget.

**React Native / Unistyles:** the style-object surfaces are the same shape — `padding: 16` inside a `StyleSheet.create` call is identical to an inline style object — so `spacingKeys` and `radiusKeys` work unchanged. The JSX-prop surfaces apply only if your primitives take spacing props; if they do not, empty `spacingProps` and `radiusProps` rather than leaving a list of prop names nothing in the codebase ships.

## Implementation

[`style/token-equality.ts`](token-equality.ts), behind the structural orchestrator. It returns findings and never prints or exits; reporting and the exit code belong to `structural/run-structural-checks.ts`.

## Example output

```
FAIL [style/token-equality] src/features/scan/ui/result-card.tsx:24
  gap={16} is the spacing token "md" written as a number (10=xs, 12=sm, 16=md, 20=lg, 32=xl).
  Write gap="md" instead, so this call site follows the scale when the
  scale moves. Off-scale values are deliberately fine raw — this fires only on
  an exact match, which is the only case where the fix needs no judgement.

FAIL [style/token-equality] src/features/scan/ui/badge.tsx:11
  borderRadius: 6 is the radius token "md" written as a number (2=xs, 4=sm, 6=md, 8=lg, 12=xl).
  Use the radius prop (radius="md") or the token's CSS variable instead of
  the raw px. borderRadius: "50%" for a circle stays fine — it is not a px.
```

The message names the whole scale as well as the one token, because the reader who needs it usually has a second raw value on the next line.

## Why blocking

The fix is mechanical and unambiguous — the message names the exact token to use. There is no judgement call to defer to a human, so there is nothing for a warning to buy.
