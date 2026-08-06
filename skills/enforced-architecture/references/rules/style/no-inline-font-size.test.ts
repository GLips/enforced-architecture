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
      name: "a directory that merely starts like the primitives layer is not the token source",
      filename: "/repo/src/shared/ui-legacy/theme.ts",
      code: `export const styles = { fontSize: 13 };`,
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
      name: "the token source has to write the numbers the named sizes resolve to",
      filename: "/repo/src/shared/ui/theme.ts",
      code: `export const scale = { fontSize: 13 };`,
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
