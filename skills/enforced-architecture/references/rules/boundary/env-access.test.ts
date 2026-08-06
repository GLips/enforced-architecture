import { describeRule } from "../lib/rule-spec.ts";
import { envAccessRule } from "./env-access.ts";

const SERVICE = "/repo/src/features/billing/service/charge.ts";

describeRule("boundary/env-access", envAccessRule, {
  obvious: [
    {
      name: "the plain read the rule's header names",
      filename: SERVICE,
      code: `const key = process.env.STRIPE_KEY;`,
      errors: [{ messageId: "envOutsideEnvModule" }],
    },
    {
      name: "the same read from a UI component, where the value also ships to the browser",
      filename: "/repo/src/features/billing/ui/panel.tsx",
      code: `export const Panel = () => process.env.PUBLIC_URL;`,
      errors: [{ messageId: "envOutsideEnvModule" }],
    },
  ],

  adversarial: [
    {
      name: "a computed lookup, which bundlers also fail to inline",
      filename: SERVICE,
      code: `const key = process["env"].STRIPE_KEY;`,
      errors: [{ messageId: "envOutsideEnvModule" }],
    },
    {
      name: "reaching process off the global object puts a member expression where the identifier was",
      filename: SERVICE,
      code: `const key = globalThis.process.env.STRIPE_KEY;\nconst other = globalThis["process"].env.API_URL;`,
      errors: [{ messageId: "envOutsideEnvModule" }, { messageId: "envOutsideEnvModule" }],
    },
    {
      name: "destructuring under an alias hides both the binding name and the property read",
      filename: SERVICE,
      code: `const { env: config } = process;\nexport const key = config.STRIPE_KEY;`,
      errors: [{ messageId: "envOutsideEnvModule" }],
    },
    {
      name: "the bundler-specific form is a MetaProperty, an entirely different node shape",
      filename: SERVICE,
      code: `const url = import.meta.env.VITE_PUBLIC_URL;`,
      errors: [{ messageId: "envOutsideEnvModule" }],
    },
    {
      name: "importing the binding sidesteps every check written against the global",
      filename: SERVICE,
      code: `import { env as nodeEnv } from "node:process";\nexport const key = nodeEnv.STRIPE_KEY;`,
      errors: [{ messageId: "envOutsideEnvModule" }],
    },
    {
      name: "a namespace import renames the global but not the read",
      filename: SERVICE,
      code: `import * as process from "node:process";\nexport const key = process.env.STRIPE_KEY;`,
      errors: [{ messageId: "envOutsideEnvModule" }],
    },
  ],

  legal: [
    {
      name: "the one module allowed to read env, which is the point of the rule",
      filename: "/repo/src/env.ts",
      code: `export const env = { stripeKey: process.env.STRIPE_KEY ?? "", publicUrl: import.meta.env.VITE_PUBLIC_URL ?? "" };`,
    },
    {
      name: "reading the validated config the env module exports",
      filename: SERVICE,
      code: `import { env } from "@/env";\nexport const charge = () => env.stripeKey;`,
    },
    {
      name: "an unrelated object with an env property",
      filename: SERVICE,
      code: `const deployTarget = { env: "production" };\nexport const label = deployTarget.env;`,
    },
    {
      name: "destructuring env off something that is not process",
      filename: SERVICE,
      code: `const deployTarget = { env: "production" };\nconst { env: targetEnv } = deployTarget;\nexport const label = targetEnv;`,
    },
    {
      name: "a different property of process is not an environment read",
      filename: SERVICE,
      code: `export const runtimeVersion = process["version"];`,
    },
    {
      name: "node:process has exports that are not env",
      filename: SERVICE,
      code: `import { cwd } from "node:process";\nexport const here = cwd();`,
    },
    {
      name: "a test may read the environment it is setting up",
      filename: "/repo/src/features/billing/service/charge.test.ts",
      code: `const key = process.env.STRIPE_KEY;`,
    },
    {
      name: "what the build reads is a different question from what a running app believes",
      filename: "/repo/vite.config.ts",
      code: `export default { define: { mode: process.env.NODE_ENV } };`,
    },
  ],
});
