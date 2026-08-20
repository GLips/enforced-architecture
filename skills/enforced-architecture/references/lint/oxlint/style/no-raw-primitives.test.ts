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
      name: "a namespace import names no specifier, so the primitive arrives under a member read",
      filename: COMPONENT,
      code: `import * as RN from "react-native";\nexport const Row = () => <RN.View />;`,
      errors: [{ messageId: "platformPrimitive" }],
    },
    {
      name: "the CommonJS spelling, where the binding carries no link to the module",
      filename: COMPONENT,
      code: `const { View } = require("react-native");\nexport const used = View;`,
      errors: [{ messageId: "platformPrimitive" }],
    },
    {
      name: "a dynamic-import destructure, deferred past every static import visitor",
      filename: COMPONENT,
      code: `const { View } = await import("react-native");\nexport const used = View;`,
      errors: [{ messageId: "platformPrimitive" }],
    },
    {
      name: "loading and reading in one expression, which binds no name at all",
      filename: COMPONENT,
      code: `export const used = (await import("react-native")).View;`,
      errors: [{ messageId: "platformPrimitive" }],
    },
    {
      name: "the CommonJS load read straight off the call, binding nothing",
      filename: COMPONENT,
      code: `export const used = require("react-native").View;`,
      errors: [{ messageId: "platformPrimitive" }],
    },
    {
      name: "the whole module bound to one name, then read a member at a time",
      filename: COMPONENT,
      code: `const RN = require("react-native");\nexport const used = RN.View;`,
      errors: [{ messageId: "platformPrimitive" }],
    },
    {
      name: "a namespace import destructured later, so no member read appears either",
      filename: COMPONENT,
      code: `import * as RN from "react-native";\nconst { View } = RN;\nexport const used = View;`,
      errors: [{ messageId: "platformPrimitive" }],
    },
    {
      name: "the TypeScript import-equals form, which reaches no ImportDeclaration",
      filename: COMPONENT,
      code: `import RN = require("react-native");\nexport const used = RN.View;`,
      errors: [{ messageId: "platformPrimitive" }],
    },
    {
      name: "the default export wearing a named specifier's shape, so the module object binds as RN",
      filename: COMPONENT,
      code: `import { default as RN } from "react-native";\nexport const used = RN.View;`,
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
      name: "an inline type specifier is erased too, even beside a value one",
      filename: COMPONENT,
      code: `import { Platform, type View } from "react-native";\nexport const os = Platform.OS;\nexport type Ref = View;`,
    },
    {
      name: "the type-only import-equals form binds a namespace that exists only in type position",
      filename: COMPONENT,
      code: `import type RN = require("react-native");\nexport type Ref = RN.View;`,
    },
    {
      name: "a utility API reached through a namespace import is still a utility API",
      filename: COMPONENT,
      code: `import * as RN from "react-native";\nexport const os = RN.Platform.OS;`,
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
