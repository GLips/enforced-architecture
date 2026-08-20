import { describeRule } from "../lib/rule-spec.ts";
import { noDeprecatedInputValidatorRule } from "./no-deprecated-input-validator.ts";

const CONTROLLER = "/repo/src/features/billing/controllers/refund.ts";
const IMPORTS = `import { createMiddleware, createServerFn } from "@tanstack/react-start";\nimport { z } from "zod";`;

describeRule("placement/no-deprecated-input-validator", noDeprecatedInputValidatorRule, {
  obvious: [
    {
      name: "the deprecated validator method on a server function",
      filename: CONTROLLER,
      code: `${IMPORTS}\nexport const charge = createServerFn()\n  .inputValidator(z.object({ id: z.string() }))\n  .handler(async ({ data }) => data);`,
      errors: [{ messageId: "deprecatedInputValidator" }],
    },
    {
      name: "the same method on middleware, which shares the builder API",
      filename: CONTROLLER,
      code: `${IMPORTS}\nexport const validated = createMiddleware({ type: "function" })\n  .inputValidator(z.object({ id: z.string() }))\n  .server(({ next }) => next());`,
      errors: [{ messageId: "deprecatedInputValidator" }],
    },
  ],

  adversarial: [
    {
      name: "an intermediate link in the chain hides the factory from the receiver's own callee",
      filename: CONTROLLER,
      code: `${IMPORTS}\nexport const refund = createServerFn()\n  .middleware([])\n  .inputValidator(z.object({ id: z.string() }))\n  .handler(async ({ data }) => data);`,
      errors: [{ messageId: "deprecatedInputValidator" }],
    },
    {
      name: "a computed member access spells the method without an identifier",
      filename: CONTROLLER,
      code: `${IMPORTS}\nexport const refund = createServerFn()["inputValidator"](z.object({ id: z.string() }));`,
      errors: [{ messageId: "deprecatedInputValidator" }],
    },
    {
      name: "the factory reached through a namespace is still the same builder",
      filename: CONTROLLER,
      code: `import * as start from "@tanstack/react-start";\nimport { z } from "zod";\nexport const refund = start.createServerFn().inputValidator(z.object({ id: z.string() }));`,
      errors: [{ messageId: "deprecatedInputValidator" }],
    },
    {
      name: "a builder returned from a factory function, where a top-level scan sees nothing",
      filename: CONTROLLER,
      code: `${IMPORTS}\nexport const makeEndpoint = () =>\n  createServerFn().inputValidator(z.object({ id: z.string() })).handler(async () => null);`,
      errors: [{ messageId: "deprecatedInputValidator" }],
    },
    {
      name: "two builders in one file are two separate migrations, not one",
      filename: CONTROLLER,
      code: `${IMPORTS}\nexport const refund = createServerFn().inputValidator(z.object({})).handler(async () => null);\nexport const audit = createMiddleware({ type: "function" }).inputValidator(z.object({})).server(({ next }) => next());`,
      errors: [
        { messageId: "deprecatedInputValidator" },
        { messageId: "deprecatedInputValidator" },
      ],
    },
    {
      name: "optional chaining changes the call node's shape but not the method being called",
      filename: CONTROLLER,
      code: `${IMPORTS}\nexport const refund = createServerFn()?.inputValidator?.(z.object({ id: z.string() }));`,
      errors: [{ messageId: "deprecatedInputValidator" }],
    },
  ],

  legal: [
    {
      name: "the replacement method on a server function",
      filename: CONTROLLER,
      code: `${IMPORTS}\nexport const list = createServerFn()\n  .validator(z.object({ id: z.string() }))\n  .handler(async ({ data }) => data);`,
    },
    {
      name: "the replacement method on middleware",
      filename: CONTROLLER,
      code: `${IMPORTS}\nexport const validated = createMiddleware({ type: "function" })\n  .validator(z.object({ id: z.string() }))\n  .server(({ next }) => next());`,
    },
    {
      name: "an unrelated object exposing the same method name is not a TanStack builder",
      filename: "/repo/src/features/billing/service/forms.ts",
      code: `import { formSchema } from "@/features/billing/service/schema";\nexport const parse = (input) => formSchema.inputValidator(input);`,
    },
    {
      name: "that unrelated method stays legal even in a file that does define a server function",
      filename: CONTROLLER,
      code: `${IMPORTS}\nimport { formSchema } from "@/features/billing/service/schema";\nexport const parse = (input) => formSchema.inputValidator(input);\nexport const list = createServerFn().validator(z.object({})).handler(async () => null);`,
    },
    {
      name: "a plain function that happens to be named inputValidator is not a builder method",
      filename: "/repo/src/features/billing/service/forms.ts",
      code: `const inputValidator = (value) => value;\nexport const parse = (value) => inputValidator(value);`,
    },
    {
      name: "the name as an object key, never called, is just configuration",
      filename: "/repo/src/features/billing/service/forms.ts",
      code: `import { z } from "zod";\nexport const config = { inputValidator: z.object({ id: z.string() }) };`,
    },
    {
      name: "a test may pin the old API while the migration is in flight",
      filename: "/repo/src/features/billing/controllers/refund.test.ts",
      code: `${IMPORTS}\nexport const refund = createServerFn().inputValidator(z.object({})).handler(async () => null);`,
    },
    {
      name: "a one-off script sits outside the architecture contract",
      filename: "/repo/scripts/backfill.ts",
      code: `${IMPORTS}\nexport const refund = createServerFn().inputValidator(z.object({})).handler(async () => null);`,
    },
  ],
});
