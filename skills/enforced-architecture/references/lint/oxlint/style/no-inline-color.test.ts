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
      // One keyword between the prop and its literal, and a rule reading the container's
      // expression directly is off. Its sibling `style/no-inline-style-prop` reads the same
      // `lib/transparent-wrappers.ts` list, so leaving this open meant one cast turned the colour
      // half of the style tier off while the style-prop half still reported.
      name: "a cast, a satisfies and a non-null assertion each wedge a node between prop and literal",
      filename: COMPONENT,
      code: `export const Row = () => <><Text c={"#0a0c10" as Color} /><Box bg={"#fff" satisfies Color} /><Text c={"#abc"!} /></>;`,
      errors: [
        { messageId: "rawColor" },
        { messageId: "rawColor" },
        { messageId: "rawColor" },
      ],
    },
    {
      // ONE string value holding both, which is what pins the cession's scope. The class is
      // removed from the text before matching; the string is not. Split these across two
      // properties and the case passes against a strip that discards any string containing a
      // bracket class — which loses every colour that shares a `cn()` argument or a `cva` row
      // with one, and loses it to no rule at all.
      name: "a bare colour beside an arbitrary-value class in the same string is still this rule's",
      filename: COMPONENT,
      code: `export const styles = { className: "text-[13px] #0a0c10" };`,
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
      // The cession, and it is the whole reason this rule strips class syntax before matching.
      // `style/no-arbitrary-class-values` reports both of these, and its message names the token
      // CLASS. Reporting here as well prescribes `var(--app-surface)`, which written into the
      // bracket draws that rule's `arbitraryVar` — one defect, three diagnostics, no terminating
      // fix.
      name: "a colour literal inside a utility class belongs to the class rule, not this one",
      filename: COMPONENT,
      code: `export const s = { className: "bg-[#0a0c10]", hover: "hover:text-[rgb(10,12,16)]" };`,
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
