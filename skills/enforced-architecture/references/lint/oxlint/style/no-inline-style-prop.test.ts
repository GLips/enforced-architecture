import { describeRule } from "../lib/rule-spec.ts";
import { noInlineStylePropRule } from "./no-inline-style-prop.ts";

const COMPONENT = "/repo/src/features/billing/ui/panel.tsx";

describeRule("style/no-inline-style-prop", noInlineStylePropRule, {
  obvious: [
    {
      name: "an inline style object, which accepts any property at any value",
      filename: COMPONENT,
      code: `export const Panel = () => <div style={{ padding: 12 }} />;`,
      errors: [{ messageId: "inlineStyleObject" }],
    },
    {
      name: "the same object spread over several lines",
      filename: COMPONENT,
      code: `export const Row = () => (\n  <span\n    style={{\n      padding: 12,\n      margin: 4,\n    }}\n  />\n);`,
      errors: [{ messageId: "inlineStyleObject" }],
    },
  ],

  adversarial: [
    {
      name: "a spread inside the object still leaves a literal to fill in",
      filename: COMPONENT,
      code: `export const Row = ({ base }: { base: object }) => <span style={{ ...base, padding: 12 }} />;`,
      errors: [{ messageId: "inlineStyleObject" }],
    },
    {
      name: "a cast moves the object out of the top position without changing what ships",
      filename: COMPONENT,
      code: `import type { CSSProperties } from "react";\nexport const Row = () => <span style={{ padding: 12 } as CSSProperties} />;`,
      errors: [{ messageId: "inlineStyleObject" }],
    },
    // `as` was the only one of the wrappers this rule had a case for, so the other spellings could
    // be dropped with the suite green. They are lib/transparent-wrappers.ts's list now, and these
    // two hold this rule's end of that agreement.
    {
      name: "satisfies is the same packaging as a cast, one keyword over",
      filename: COMPONENT,
      code: `import type { CSSProperties } from "react";\nexport const Row = () => <span style={{ padding: 12 } satisfies CSSProperties} />;`,
      errors: [{ messageId: "inlineStyleObject" }],
    },
    {
      name: "a non-null assertion on a parenthesised literal ships the literal",
      filename: COMPONENT,
      code: `export const Row = () => <span style={({ padding: 12 })!} />;`,
      errors: [{ messageId: "inlineStyleObject" }],
    },
    {
      name: "a ternary hides the literal in a branch",
      filename: COMPONENT,
      code: `export const Row = ({ open }: { open: boolean }) => <span style={open ? { padding: 12 } : undefined} />;`,
      errors: [{ messageId: "inlineStyleObject" }],
    },
    {
      name: "a style array is the idiomatic way to write the very thing the rule bans",
      filename: COMPONENT,
      code: `import { styles } from "./panel.styles";\nexport const Row = () => <span style={[styles.row, { padding: 12 }]} />;`,
      errors: [{ messageId: "inlineStyleObject" }],
    },
    {
      name: "a second occurrence in one file reports separately",
      filename: COMPONENT,
      code: `export const Row = () => <span style={{ gap: 8 }} />;\nexport const Cell = () => <span style={{ gap: 4 }} />;`,
      errors: [{ messageId: "inlineStyleObject" }, { messageId: "inlineStyleObject" }],
    },
    {
      name: "a directory that merely starts like the primitives layer is not the primitives layer",
      filename: "/repo/src/shared/ui-legacy/box.tsx",
      code: `export const Box = () => <div style={{ padding: 12 }} />;`,
      errors: [{ messageId: "inlineStyleObject" }],
    },
  ],

  legal: [
    {
      name: "token props on the primitive, which is the refactor the rule asks for",
      filename: COMPONENT,
      code: `export const Badge = () => <Box padding="m" gap="s" color="text-secondary" />;`,
    },
    {
      name: "a named stylesheet entry passed by reference is deliberately out of scope",
      filename: COMPONENT,
      code: `import { styles } from "./panel.styles";\nexport const Row = () => <Box style={styles.row} />;`,
    },
    {
      name: "an array of named entries carries no literal either",
      filename: COMPONENT,
      code: `import { styles } from "./panel.styles";\nexport const Row = () => <Box style={[styles.row, styles.dense]} />;`,
    },
    {
      name: "a prop that merely contains the word style is a different prop",
      filename: COMPONENT,
      code: `export const Row = () => <Box styles={{ padding: 12 }} />;`,
    },
    {
      name: "a plain object in module scope is not an inline style prop",
      filename: COMPONENT,
      code: `export const row = { padding: 12 };`,
    },
    {
      name: "the primitives layer is what builds on the raw surface",
      filename: "/repo/src/shared/ui/box.tsx",
      code: `export const Box = (p: { padding: number }) => <div style={{ padding: p.padding }} />;`,
    },
    {
      name: "a test may render whatever it needs to exercise a seam",
      filename: "/repo/src/features/billing/ui/panel.test.tsx",
      code: `export const Fixture = () => <div style={{ padding: 12 }} />;`,
    },
  ],
});
