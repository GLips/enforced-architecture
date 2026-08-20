import { describeRule } from "../lib/rule-spec.ts";
import { deprecatedPathsRule } from "./deprecated-paths.ts";

const UI = "/repo/src/features/billing/ui/panel.tsx";
const ROUTE = "/repo/src/routes/dashboard.tsx";
const IMPORT_DEPRECATED = `import { Button } from "@/components/button";`;

describeRule("placement/deprecated-paths", deprecatedPathsRule, {
  obvious: [
    {
      name: "a feature component importing from the directory that no longer exists",
      filename: UI,
      code: IMPORT_DEPRECATED,
      errors: [{ messageId: "componentsDirectoryRemoved" }],
    },
    {
      name: "a route reaching the same removed directory",
      filename: ROUTE,
      code: `import { Card } from "@/components/card";`,
      errors: [{ messageId: "componentsDirectoryRemoved" }],
    },
  ],

  adversarial: [
    {
      name: "a dynamic import carries the dependency without an import declaration",
      filename: UI,
      code: `export const lazyModal = async () => (await import("@/components/modal")).Modal;`,
      errors: [{ messageId: "componentsDirectoryRemoved" }],
    },
    {
      name: "a re-export depends on the removed directory as surely as an import does",
      filename: UI,
      code: `export { Badge } from "@/components/badge";`,
      errors: [{ messageId: "componentsDirectoryRemoved" }],
    },
    {
      name: "a star re-export names no binding to notice",
      filename: UI,
      code: `export * from "@/components/badge";`,
      errors: [{ messageId: "componentsDirectoryRemoved" }],
    },
    {
      name: "a type-only import still points at a path that will not resolve",
      filename: UI,
      code: `import type { ButtonProps } from "@/components/button";`,
      errors: [{ messageId: "componentsDirectoryRemoved" }],
    },
    {
      name: "quote style is a lexer detail the parsed specifier has already discarded",
      filename: UI,
      code: `import { Card } from '@/components/card';`,
      errors: [{ messageId: "componentsDirectoryRemoved" }],
    },
    {
      name: "a path several segments deep, where a one-segment pattern stops matching",
      filename: UI,
      code: `import { Row } from "@/components/table/row";`,
      errors: [{ messageId: "componentsDirectoryRemoved" }],
    },
    {
      name: "two removed-directory imports in one file are two separate fixes",
      filename: UI,
      code: `import { Button } from "@/components/button";\nimport { Card } from "@/components/card";`,
      errors: [
        { messageId: "componentsDirectoryRemoved" },
        { messageId: "componentsDirectoryRemoved" },
      ],
    },
  ],

  legal: [
    {
      name: "the shared design-system directory the primitives moved to",
      filename: UI,
      code: `import { Button } from "@/shared/ui/button";`,
    },
    {
      name: "the feature-owned UI directory the rest moved to",
      filename: UI,
      code: `import { InvoiceRow } from "@/features/billing/ui/row";`,
    },
    {
      name: "a live directory whose name merely starts with the removed one",
      filename: UI,
      code: `import { registry } from "@/components-registry/index";`,
    },
    {
      name: "a node_modules package called components is not the alias path",
      filename: UI,
      code: `import { Widget } from "components";`,
    },
    {
      name: "a relative specifier is deliberately unfenced — nothing resolves it to a project path",
      filename: UI,
      code: `import { Local } from "./components/local";`,
    },
    {
      name: "a test may still reference a path under migration",
      filename: "/repo/src/features/billing/ui/panel.test.tsx",
      code: IMPORT_DEPRECATED,
    },
    {
      name: "a one-off script sits outside the architecture contract",
      filename: "/repo/scripts/codemod-imports.ts",
      code: IMPORT_DEPRECATED,
    },
  ],
});
