import { describeRule } from "../lib/rule-spec.ts";
import { vendorComponentContainmentRule } from "./vendor-component-containment.ts";

const COMPONENT = "/repo/src/features/billing/ui/panel.tsx";

describeRule("style/vendor-component-containment", vendorComponentContainmentRule, {
  obvious: [
    {
      name: "the library component imported directly, past the app wrapper",
      filename: COMPONENT,
      code: `import { Textarea } from "@mantine/core";\nexport const Panel = () => <Textarea />;`,
      errors: [{ messageId: "unwrappedVendorComponent" }],
    },
    {
      name: "the same bypass from a non-UI module, which the rule also governs",
      filename: "/repo/src/features/billing/service/compose.ts",
      code: `import { Textarea } from "@mantine/core";\nexport const control = Textarea;`,
      errors: [{ messageId: "unwrappedVendorComponent" }],
    },
  ],

  adversarial: [
    {
      name: "renamed on import, so the local binding never says Textarea",
      filename: COMPONENT,
      code: `import { Textarea as MantineTextarea } from "@mantine/core";\nexport const Compose = () => <MantineTextarea />;`,
      errors: [{ messageId: "unwrappedVendorComponent" }],
    },
    {
      name: "alongside other specifiers, where a single-specifier pattern stops at the first",
      filename: COMPONENT,
      code: `import {\n  Button,\n  Textarea,\n  Group,\n} from '@mantine/core';\nexport const used = [Button, Textarea, Group];`,
      errors: [{ messageId: "unwrappedVendorComponent" }],
    },
    {
      name: "an inline type specifier next to the value one does not exempt the declaration",
      filename: COMPONENT,
      code: `import { type TextareaProps, Textarea } from "@mantine/core";\nexport const used = Textarea;\nexport type P = TextareaProps;`,
      errors: [{ messageId: "unwrappedVendorComponent" }],
    },
    {
      name: "a re-export hands the unwrapped component on without the word import appearing",
      filename: COMPONENT,
      code: `export { Textarea } from "@mantine/core";`,
      errors: [{ messageId: "unwrappedVendorComponent" }],
    },
    {
      name: "a star re-export names no specifier to blame",
      filename: COMPONENT,
      code: `export * from "@mantine/core";`,
      errors: [{ messageId: "vendorStarReExport" }],
    },
    {
      name: "a file that merely starts like the wrapper's path is not the wrapper",
      filename: "/repo/src/shared/ui/textarea-legacy.tsx",
      code: `import { Textarea } from "@mantine/core";\nexport const Legacy = () => <Textarea />;`,
      errors: [{ messageId: "unwrappedVendorComponent" }],
    },
  ],

  legal: [
    {
      name: "the app wrapper, which carries the shared convention",
      filename: COMPONENT,
      code: `import { Textarea } from "@/shared/ui/textarea";\nexport const Panel = () => <Textarea />;`,
    },
    {
      name: "unwrapped siblings from the same library are nobody's to contain",
      filename: COMPONENT,
      code: `import { Button, Group, Stack } from "@mantine/core";\nexport const used = [Button, Group, Stack];`,
    },
    {
      name: "a type-only import pulls in no runtime component",
      filename: COMPONENT,
      code: `import type { TextareaProps } from "@mantine/core";\nexport type Props = TextareaProps;`,
    },
    {
      name: "an identifier that merely starts the same way is a different component",
      filename: COMPONENT,
      code: `import { TextareaAutosize } from "@mantine/core";\nexport const used = TextareaAutosize;`,
    },
    {
      name: "a different library that happens to export the same name",
      filename: COMPONENT,
      code: `import { Textarea } from "@mantine/dates";\nexport const used = Textarea;`,
    },
    {
      name: "the wrapper module MUST import the original — it is the one file that may",
      filename: "/repo/src/shared/ui/textarea.tsx",
      code: `import { Textarea as Base } from "@mantine/core";\nexport const Textarea = (p: Record<string, unknown>) => <Base {...p} />;`,
    },
    {
      name: "a test may reach past the wrapper to exercise the original",
      filename: "/repo/src/features/billing/ui/panel.test.tsx",
      code: `import { Textarea } from "@mantine/core";\nexport const used = Textarea;`,
    },
    {
      name: "tooling outside src/ is not application source",
      filename: "/repo/tooling/preview/gallery.tsx",
      code: `import { Textarea } from "@mantine/core";\nexport const Gallery = () => <Textarea />;`,
    },
  ],
});
