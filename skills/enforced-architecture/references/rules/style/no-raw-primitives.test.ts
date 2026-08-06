import { describeRule } from "../lib/rule-spec.ts";
import { noRawPrimitivesRule } from "./no-raw-primitives.ts";

const COMPONENT = "/repo/src/features/billing/ui/panel.tsx";

describeRule("style/no-raw-primitives", noRawPrimitivesRule, {
  obvious: [
    {
      name: "a raw HTML element instead of a token-aware primitive",
      filename: COMPONENT,
      code: `export const Panel = () => <div />;`,
      errors: [{ messageId: "rawHtmlElement" }],
    },
    {
      name: "a core rendering primitive imported from the platform module",
      filename: COMPONENT,
      code: `import { View } from "react-native";\nexport const used = View;`,
      errors: [{ messageId: "platformPrimitive" }],
    },
  ],

  adversarial: [
    {
      name: "attributes and children, not the bare self-closing shape",
      filename: COMPONENT,
      code: `export const Row = () => <section className="row">{null}</section>;`,
      errors: [{ messageId: "rawHtmlElement" }],
    },
    {
      name: "nested inside a legal primitive, where a top-level scan misses it",
      filename: COMPONENT,
      code: `export const Cell = () => (\n  <Box><span>text</span></Box>\n);`,
      errors: [{ messageId: "rawHtmlElement" }],
    },
    {
      name: "an alias renames the binding but not the imported primitive",
      filename: COMPONENT,
      code: `import { View as Screen } from "react-native";\nexport const used = Screen;`,
      errors: [{ messageId: "platformPrimitive" }],
    },
    {
      name: "one primitive among legal utility APIs and an inline type specifier",
      filename: COMPONENT,
      code: `import { Platform, type ViewProps, Pressable } from "react-native";\nexport const used = [Platform, Pressable];\nexport type P = ViewProps;`,
      errors: [{ messageId: "platformPrimitive" }],
    },
    {
      name: "a re-export hands the primitive on without the word import appearing",
      filename: COMPONENT,
      code: `export { Text } from "react-native";`,
      errors: [{ messageId: "platformPrimitive" }],
    },
    {
      name: "a star re-export names no binding to notice",
      filename: COMPONENT,
      code: `export * from "react-native";`,
      errors: [{ messageId: "platformStarReExport" }],
    },
    {
      name: "a directory that merely starts like the primitives layer is not exempt",
      filename: "/repo/src/shared/ui-legacy/box.tsx",
      code: `export const Box = () => <div />;`,
      errors: [{ messageId: "rawHtmlElement" }],
    },
  ],

  legal: [
    {
      name: "the app's own primitives, including one sharing a name with a platform primitive",
      filename: COMPONENT,
      code: `import { Box, Stack, Text } from "@/shared/ui";\nexport const Badge = () => (\n  <Box><Stack><Text>hi</Text></Stack></Box>\n);`,
    },
    {
      name: "utility APIs from the platform module are not the design system's to own",
      filename: COMPONENT,
      code: `import { Platform, StyleSheet, useWindowDimensions } from "react-native";\nexport const used = [Platform, StyleSheet, useWindowDimensions];`,
    },
    {
      name: "a type-only import renders nothing",
      filename: COMPONENT,
      code: `import type { View } from "react-native";\nexport type Ref = View;`,
    },
    {
      name: "a member tag is never an intrinsic element",
      filename: COMPONENT,
      code: `export const Badge = () => <Card.Header />;`,
    },
    {
      name: "a package that merely starts with the platform module's name is a different package",
      filename: COMPONENT,
      code: `import { View } from "react-native-web";\nexport const used = View;`,
    },
    {
      name: "the primitives layer is where the raw elements are allowed to live",
      filename: "/repo/src/shared/ui/box.tsx",
      code: `export const Box = (p: { children?: unknown }) => <div>{p.children}</div>;`,
    },
    {
      name: "the documented render boundary builds the actual document",
      filename: "/repo/src/routes/__root.tsx",
      code: `export const Root = () => <div id="app" />;`,
    },
    {
      name: "a test may render whatever it needs to exercise a seam",
      filename: "/repo/src/features/billing/ui/panel.test.tsx",
      code: `export const Fixture = () => <div />;`,
    },
  ],
});
