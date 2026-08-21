import { describeRule } from "../lib/rule-spec.ts";
import { noInlineFontSizeRule } from "./no-inline-font-size.ts";

const COMPONENT = "/repo/src/features/billing/ui/panel.tsx";

describeRule("style/no-inline-font-size", noInlineFontSizeRule, {
  obvious: [
    {
      name: "a raw pixel size instead of a name from the scale",
      filename: COMPONENT,
      code: `export const styles = { fontSize: 13 };`,
      errors: [{ messageId: "rawFontSize" }],
    },
    {
      name: "the same override written inline on an element",
      filename: COMPONENT,
      code: `export const Row = () => <span style={{ fontSize: 12 }} />;`,
      errors: [{ messageId: "rawFontSize" }],
    },
  ],

  adversarial: [
    {
      name: "a quoted key is the same property, not a different one",
      filename: COMPONENT,
      code: `export const styles = { "fontSize": "12px" };`,
      errors: [{ messageId: "rawFontSize" }],
    },
    {
      name: "a string value with a unit, where a numeric-literal pattern would miss",
      filename: COMPONENT,
      code: `export const Row = () => <span style={{ fontSize: "0.8125rem" }} />;`,
      errors: [{ messageId: "rawFontSize" }],
    },
    {
      name: "a computed value is still a value off the scale",
      filename: COMPONENT,
      code: `export const styles = { fontSize: 13 * 1.2 };`,
      errors: [{ messageId: "rawFontSize" }],
    },
    {
      // A computed key is not the same thing as an unknown one. `["fontSize"]` names the property
      // as plainly as `fontSize` does, and it is the spelling a codebase drifts toward once the
      // two shorter ones start reporting. The genuinely dynamic `[key]` stays legal below.
      name: "a bracketed string key is the same property wearing the computed spelling",
      filename: COMPONENT,
      code: `export const styles = { ["fontSize"]: 13 };`,
      errors: [{ messageId: "rawFontSize" }],
    },
    {
      name: "a second occurrence in one file reports separately",
      filename: COMPONENT,
      code: `export const a = { fontSize: 13 };\nexport const b = { fontSize: 14 };`,
      errors: [{ messageId: "rawFontSize" }, { messageId: "rawFontSize" }],
    },
    {
      name: "the header says 'props' too, so a JSX attribute is the same violation",
      filename: COMPONENT,
      code: `export const Row = () => <Text fontSize={13} />;`,
      errors: [{ messageId: "rawFontSize" }],
    },
    {
      name: "the destructured token spent on a style object is shorthand, and still the banned key",
      filename: COMPONENT,
      code: `export const Row = (theme: Theme) => {\n  const { fontSize } = theme.typography.caption;\n  return <span style={{ fontSize }} />;\n};`,
      errors: [{ messageId: "rawFontSize" }],
    },
    {
      name: "a directory that merely starts like the primitives layer is not the token source",
      filename: "/repo/src/shared/ui-legacy/theme.ts",
      code: `export const styles = { fontSize: 13 };`,
      errors: [{ messageId: "rawFontSize" }],
    },
    {
      // The message, asserted, because its wording is the half of this rule that had to change
      // when the primitives layer became exempt. It must NOT name `var(--text-caption)` or
      // `theme.typography.caption`: both are values assigned to `fontSize`, so a reader who does
      // what the message says draws this same diagnostic again. `absent` is the load-bearing
      // assertion here — it is the only way to state that the token spellings are deliberately
      // not offered outside the primitives.
      name: "the message names the prop form, and not a token spelling that reports again",
      filename: COMPONENT,
      code: `export const Row = () => <span style={{ fontSize: "var(--text-caption)" }} />;`,
      errors: [
        {
          message:
            "Raw fontSize override. Use a named size from the type scale instead — a size prop on the text primitive (`size='caption'`, `variant='heading-xs'`), or a semantic type class (`text-caption`). Setting `fontSize` to a scale token is still setting `fontSize`; the primitives layer is the one place that does it. If the size you want is not on the scale, add it to the scale rather than writing it here. See docs/architecture/design-system.md.",
        },
      ],
    },
    {
      // The exemption is the PROFILE, so a feature's own `ui/` folder is not the primitives layer
      // and does not inherit it. Without this the exemption below reads as a path suffix and every
      // `ui/` directory in the tree turns the rule off.
      name: "a feature's own ui folder is not the primitives layer",
      filename: "/repo/src/features/billing/ui/text.tsx",
      code: `export const T = () => <span style={{ fontSize: theme.typography.caption }} />;`,
      errors: [{ messageId: "rawFontSize" }],
    },
  ],

  legal: [
    {
      name: "a named size from the scale, which is the fix the message names",
      filename: COMPONENT,
      code: `export const Badge = () => <Text size="caption" variant="heading-xs" />;`,
    },
    {
      name: "the scale token reached through the primitive's own prop",
      filename: COMPONENT,
      code: `export const Badge = () => <Text fz="var(--text-caption)" />;`,
    },
    {
      name: "keys that merely contain or resemble the name are different properties",
      filename: COMPONENT,
      code: `export const styles = { minFontSize: 12, fontSizeToken: "caption" };`,
    },
    {
      name: "sibling type properties are not banned while they have no token to point at",
      filename: COMPONENT,
      code: `export const styles = { lineHeight: 1.4, letterSpacing: 0.2 };`,
    },
    {
      name: "a computed key has no static name, so the rule declines to guess",
      filename: COMPONENT,
      code: `export const styles = (key: string) => ({ [key]: 13 });`,
    },
    {
      name: "reading a scale token off the theme binds a name; it does not set a size",
      filename: COMPONENT,
      code: `export const size = (theme: Theme) => {\n  const { fontSize } = theme.typography.caption;\n  return fontSize;\n};`,
    },
    {
      name: "the same read written as an assignment target binds the name too, it does not set a size",
      filename: COMPONENT,
      code: `export const size = (theme: Theme) => {\n  let fontSize;\n  ({ fontSize } = theme.typography.caption);\n  return fontSize;\n};`,
    },
    {
      name: "a default inside a pattern is the blind spot the header names, not coverage",
      filename: COMPONENT,
      code: `export const Row = ({ fontSize = 13 }: Props) => <span data-size={fontSize} />;`,
    },
    {
      name: "the token source has to write the numbers the named sizes resolve to",
      filename: "/repo/src/shared/ui/theme.ts",
      code: `export const scale = { fontSize: 13 };`,
    },
    {
      // The blind spot the header names, not coverage. The exemption does not read the value, so
      // a raw number inside the primitives layer is reported by nothing in the catalog. Pinned so
      // that a later reader finds the hole stated rather than discovering it.
      name: "a raw size inside the primitives layer is the exemption's cost, and nothing else catches it",
      filename: "/repo/src/shared/ui/text.tsx",
      code: `export const T = () => <span style={{ fontSize: 13 }} />;`,
    },
    {
      // The primitive implementing `size='caption'` — the fix this rule's own message names.
      // `fontSize` has to become a real declaration somewhere, and this is the layer that does it;
      // reporting here forbids the remedy. `style/no-inline-style-prop` is silent on the same file
      // for the same reason, which is what makes the pair jointly actionable.
      name: "the primitive turning a token prop into a real declaration is the fix, not the defect",
      filename: "/repo/src/shared/ui/text.tsx",
      code: `export const Text = ({ size }: { size: SizeToken }) => (\n  <span style={{ fontSize: theme.typography[size] }} />\n);`,
    },
    {
      name: "a non-UI layer is exempt because it should carry no styling at all",
      filename: "/repo/src/domains/pricing/render.ts",
      code: `export const opts = { fontSize: 13 };`,
    },
    {
      name: "a test may assert on the number a named size resolves to",
      filename: "/repo/src/features/billing/ui/panel.test.tsx",
      code: `export const expected = { fontSize: 13 };`,
    },
  ],
});
