import { describeRule } from "../lib/rule-spec.ts";
import { noInlineColorRule } from "./no-inline-color.ts";

const COMPONENT = "/repo/src/features/billing/ui/panel.tsx";

describeRule("style/no-inline-color", noInlineColorRule, {
  obvious: [
    {
      name: "a hex literal in an inline style object",
      filename: COMPONENT,
      code: `export const Panel = () => <div style={{ color: "#0a0c10" }} />;`,
      errors: [{ messageId: "rawColor" }],
    },
    {
      name: "an rgba value in a style table",
      filename: COMPONENT,
      code: `export const styles = { background: "rgba(10, 12, 16, 0.5)" };`,
      errors: [{ messageId: "rawColor" }],
    },
    {
      name: "a hex on a component's color prop",
      filename: COMPONENT,
      code: `export const Row = () => <Text c="#0a0c10" />;`,
      errors: [{ messageId: "rawColor" }],
    },
  ],

  adversarial: [
    {
      name: "hsla is a color function too, and single quotes are the same string",
      filename: COMPONENT,
      code: `export const styles = { shadow: 'hsla(210, 20%, 5%, 0.4)' };`,
      errors: [{ messageId: "rawColor" }],
    },
    {
      name: "the three-digit hex shorthand is still a hex",
      filename: COMPONENT,
      code: `export const styles = { accent: "#fff" };`,
      errors: [{ messageId: "rawColor" }],
    },
    {
      name: "a hex buried inside a longer value, where the string is not itself a color",
      filename: COMPONENT,
      code: `export const styles = { gradient: "linear-gradient(90deg, #0a0c10, transparent)" };`,
      errors: [{ messageId: "rawColor" }],
    },
    {
      name: "a backtick is a spelling of a string literal, not a different kind of value",
      filename: COMPONENT,
      code: "export const styles = { border: `#0a0c10` };",
      errors: [{ messageId: "rawColor" }],
    },
    {
      name: "an expression container around the prop value ships the same color",
      filename: COMPONENT,
      code: `export const Row = () => <Box bg={"#0a0c10"} />;`,
      errors: [{ messageId: "rawColor" }],
    },
    {
      name: "a computed key hides nothing, because the value is what is off-system",
      filename: COMPONENT,
      code: `export const styles = (prop: string) => ({ [prop]: "#0a0c10" });`,
      errors: [{ messageId: "rawColor" }],
    },
    {
      name: "a directory that merely starts like the non-UI layer is not exempt",
      filename: "/repo/src/domains-legacy/pricing/palette.ts",
      code: `export const palette = { brand: "#0a0c10" };`,
      errors: [{ messageId: "rawColor" }],
    },
  ],

  legal: [
    {
      name: "a CSS variable token, which is the fix the message names",
      filename: COMPONENT,
      code: `export const styles = { color: "var(--app-text-secondary)" };`,
    },
    {
      name: "a theme object reference carries no literal to drift",
      filename: COMPONENT,
      code: `import { theme } from "@/shared/ui/theme";\nexport const styles = { background: theme.colors.surface };`,
    },
    {
      name: "a color function wrapping a token has no literal channel",
      filename: COMPONENT,
      code: `export const styles = { border: "rgb(var(--brand-rgb))" };`,
    },
    {
      name: "an anchor href is not one of the color props",
      filename: COMPONENT,
      code: `export const A = () => <a href="#abc123" />;`,
    },
    {
      name: "a hash that carries non-hex characters is a fragment id",
      filename: COMPONENT,
      code: `export const styles = { target: "#main", key: "#zebra" };`,
    },
    {
      name: "the token source has to write the literals the tokens resolve to",
      filename: "/repo/src/shared/ui/theme.ts",
      code: `export const colors = { surface: "#0a0c10" };`,
    },
    {
      name: "a non-UI layer is exempt because it should carry no styling at all",
      filename: "/repo/src/domains/pricing/rules.ts",
      code: `export const palette = { brand: "#0a0c10" };`,
    },
    {
      name: "a test may assert on the literal a token resolves to",
      filename: "/repo/src/features/billing/ui/panel.test.tsx",
      code: `export const expected = { color: "#0a0c10" };`,
    },
  ],
});
