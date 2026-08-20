import { describeRule } from "../lib/rule-spec.ts";
import { serverFnValidationRule } from "./server-fn-validation.ts";

const CONTROLLERS = "/repo/src/features/billing/controllers/charge.ts";
const missingValidator = [{ messageId: "missingValidator" }];

describeRule("placement/server-fn-validation", serverFnValidationRule, {
  obvious: [
    {
      name: "a handler destructuring data with no validator between the two calls",
      filename: CONTROLLERS,
      code: `export const charge = createServerFn({ method: "POST" }).handler(async ({ data }) => data);`,
      errors: missingValidator,
    },
    {
      name: "a handler that reads data alongside context still needs the payload validated",
      filename: CONTROLLERS,
      code: `export const partial = createServerFn({ method: "POST" })\n  .handler(async ({ data, context }) => [data, context]);`,
      errors: missingValidator,
    },
  ],

  adversarial: [
    {
      // The defect that motivated the port: in a typed codebase every real handler carries
      // `): Promise<T> =>`, and the GritQL snippet had no slot for it, so the rule matched
      // nothing for its entire life while reporting green.
      name: "a return-type annotation sits between the params and the body",
      filename: CONTROLLERS,
      code: `export const annotated = createServerFn({ method: "POST" }).handler(async ({ data }): Promise<unknown> => data);`,
      errors: missingValidator,
    },
    {
      name: "an annotated synchronous handler crosses both the async and the annotation axis",
      filename: CONTROLLERS,
      code: `export const annotatedSync = createServerFn({ method: "POST" }).handler(({ data }): unknown => data);`,
      errors: missingValidator,
    },
    {
      name: "a function expression handler is not an arrow at all",
      filename: CONTROLLERS,
      code: `export const legacy = createServerFn({ method: "POST" }).handler(async function ({ data }) { return data; });`,
      errors: missingValidator,
    },
    {
      name: "a single unnamed parameter binds the whole options object, data included",
      filename: CONTROLLERS,
      code: `export const raw = createServerFn().handler(async (options) => options.data);`,
      errors: missingValidator,
    },
    {
      name: "middleware in the chain is not validation and must not stand in for it",
      filename: CONTROLLERS,
      code: `export const guarded = createServerFn({ method: "POST" })\n  .middleware([authMiddleware])\n  .handler(async ({ data }) => data);`,
      errors: missingValidator,
    },
    {
      name: "two unvalidated chains in one file are two findings, not one",
      filename: CONTROLLERS,
      code: `export const a = createServerFn().handler(async ({ data }) => data);\nexport const b = createServerFn().handler(({ data }): unknown => data);`,
      errors: [{ messageId: "missingValidator" }, { messageId: "missingValidator" }],
    },
  ],

  legal: [
    {
      name: "a validator between the two calls is exactly what the rule asks for",
      filename: CONTROLLERS,
      code: `export const list = createServerFn({ method: "POST" })\n  .validator(invoiceFilterSchema)\n  .handler(async ({ data }) => data);`,
    },
    {
      name: "a validator further up the chain still counts",
      filename: CONTROLLERS,
      code: `export const save = createServerFn({ method: "POST" })\n  .validator(invoiceSchema)\n  .middleware([authMiddleware])\n  .handler(async ({ data }): Promise<void> => save(data));`,
    },
    {
      name: "a handler that takes no input has nothing to validate",
      filename: CONTROLLERS,
      code: `export const all = createServerFn({ method: "GET" }).handler(async () => []);`,
    },
    {
      name: "context is framework-provided, not client input",
      filename: CONTROLLERS,
      code: `export const currentUser = createServerFn().handler(async ({ context }): Promise<User> => context.user);`,
    },
    {
      name: "an unrelated builder that happens to expose .handler() is some other library",
      filename: CONTROLLERS,
      code: `export const route = router({ path: "/x" }).handler(async ({ data }) => data);`,
    },
    {
      name: "a near-miss factory name is not the server-fn factory",
      filename: CONTROLLERS,
      code: `export const fake = createServerFnMock({ method: "POST" }).handler(async ({ data }) => data);`,
    },
    {
      name: "a test file may exercise an unvalidated chain deliberately",
      filename: "/repo/src/features/billing/controllers/charge.test.ts",
      code: `const charge = createServerFn().handler(async ({ data }) => data);`,
    },
    {
      name: "a one-off script is not part of the shipped server boundary",
      filename: "/repo/scripts/backfill-invoices.ts",
      code: `const charge = createServerFn().handler(async ({ data }) => data);`,
    },
  ],
});
