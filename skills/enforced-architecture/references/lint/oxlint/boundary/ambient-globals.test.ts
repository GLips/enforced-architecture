import { describeRule } from "../lib/rule-spec.ts";
import { ambientGlobalsRule } from "./ambient-globals.ts";

const SERVICE = "/repo/src/features/billing/service/charge.ts";

describeRule("boundary/ambient-globals", ambientGlobalsRule, {
  obvious: [
    {
      name: "the plain env read the rule's header names",
      filename: SERVICE,
      code: `const key = process.env.STRIPE_KEY;`,
      errors: [{ messageId: "ambientGlobalOutsideOwner" }],
    },
    {
      name: "the same read from a UI component, where the value also ships to the browser",
      filename: "/repo/src/features/billing/ui/panel.tsx",
      code: `export const Panel = () => process.env.PUBLIC_URL;`,
      errors: [{ messageId: "ambientGlobalOutsideOwner" }],
    },
    {
      name: "a bare fetch, which no import rule in this tag can see",
      filename: SERVICE,
      code: `export const load = () => fetch("/api/invoices");`,
      errors: [{ messageId: "ambientGlobalOutsideOwner" }],
    },
    {
      name: "browser storage reached directly rather than through its wrapper",
      filename: SERVICE,
      code: `export const token = localStorage.getItem("session");`,
      errors: [{ messageId: "ambientGlobalOutsideOwner" }],
    },
  ],

  adversarial: [
    {
      name: "a computed lookup, which bundlers also fail to inline",
      filename: SERVICE,
      code: `const key = process["env"].STRIPE_KEY;`,
      errors: [{ messageId: "ambientGlobalOutsideOwner" }],
    },
    {
      name: "reaching process off the global object puts a member expression where the identifier was",
      filename: SERVICE,
      code: `const key = globalThis.process.env.STRIPE_KEY;\nconst other = globalThis["process"].env.API_URL;`,
      errors: [
        { messageId: "ambientGlobalOutsideOwner" },
        { messageId: "ambientGlobalOutsideOwner" },
      ],
    },
    {
      name: "destructuring under an alias hides both the binding name and the property read",
      filename: SERVICE,
      code: `const { env: config } = process;\nexport const key = config.STRIPE_KEY;`,
      errors: [{ messageId: "ambientGlobalOutsideOwner" }],
    },
    {
      name: "the bundler-specific env form is a MetaProperty, an entirely different node shape",
      filename: SERVICE,
      code: `const url = import.meta.env.VITE_PUBLIC_URL;`,
      errors: [{ messageId: "ambientGlobalOutsideOwner" }],
    },
    {
      name: "importing the binding sidesteps every check written against the global",
      filename: SERVICE,
      code: `import { env as nodeEnv } from "node:process";\nexport const key = nodeEnv.STRIPE_KEY;`,
      errors: [{ messageId: "ambientGlobalOutsideOwner" }],
    },
    {
      name: "a namespace import renames the global but not the read",
      filename: SERVICE,
      code: `import * as process from "node:process";\nexport const key = process.env.STRIPE_KEY;`,
      errors: [{ messageId: "ambientGlobalOutsideOwner" }],
    },
    {
      name: "the default export of node:process IS the process object, and it arrives as a named specifier",
      filename: SERVICE,
      code: `import { default as proc } from "node:process";\nexport const key = proc.env.STRIPE_KEY;`,
      errors: [{ messageId: "ambientGlobalOutsideOwner" }],
    },
    {
      name: "a re-export launders the capability downstream while this file itself reads nothing",
      filename: SERVICE,
      code: `export { env } from "node:process";`,
      errors: [{ messageId: "ambientGlobalReExported" }],
    },
    {
      name: "re-exporting the module's default hands on the object the capability hangs off",
      filename: SERVICE,
      code: `export { default as proc } from "node:process";`,
      errors: [{ messageId: "ambientGlobalReExported" }],
    },
    {
      name: "a star re-export republishes the capability without naming it",
      filename: SERVICE,
      code: `export * from "node:process";`,
      errors: [{ messageId: "ambientGlobalReExported" }],
    },
    {
      name: "the CommonJS spelling, which no import visitor sees",
      filename: SERVICE,
      code: `const process = require("node:process");\nexport const key = process.env.STRIPE_KEY;`,
      errors: [{ messageId: "ambientGlobalOutsideOwner" }],
    },
    {
      name: "destructuring the require result skips the member read entirely",
      filename: SERVICE,
      code: `const { env } = require("node:process");\nexport const key = env.STRIPE_KEY;`,
      errors: [{ messageId: "ambientGlobalOutsideOwner" }],
    },
    {
      name: "the dynamic-import spelling of the same destructure, which the require arm alone misses",
      filename: SERVICE,
      code: `const { env } = await import("node:process");\nexport const key = env.STRIPE_KEY;`,
      errors: [{ messageId: "ambientGlobalOutsideOwner" }],
    },
    {
      name: "loading and reading in one expression, which binds no name for a scope lookup to find",
      filename: SERVICE,
      code: `export const key = (await import("node:process")).env.STRIPE_KEY;`,
      errors: [{ messageId: "ambientGlobalOutsideOwner" }],
    },
    {
      name: "the CommonJS spelling of the same one-expression read",
      filename: SERVICE,
      code: `export const key = require("node:process").env.STRIPE_KEY;`,
      errors: [{ messageId: "ambientGlobalOutsideOwner" }],
    },
    {
      name: "the TypeScript import-equals form, which reaches no ImportDeclaration",
      filename: SERVICE,
      code: `import proc = require("node:process");\nexport const key = proc.env.STRIPE_KEY;`,
      errors: [{ messageId: "ambientGlobalOutsideOwner" }],
    },
    {
      name: "a TypeScript cast wedged between the load and the read",
      filename: SERVICE,
      code: `export const key = (require("node:process") as never).env.STRIPE_KEY;`,
      errors: [{ messageId: "ambientGlobalOutsideOwner" }],
    },
    {
      name: "a stack of TypeScript wrappers, each of which is transparent on its own",
      filename: SERVICE,
      code: `export const key = ((require("node:process")! as never) satisfies never).env.STRIPE_KEY;`,
      errors: [{ messageId: "ambientGlobalOutsideOwner" }],
    },
    {
      name: "an old-style type assertion, the one wrapper JSX syntax cannot spell",
      filename: SERVICE,
      code: `export const key = (<never>require("node:process")).env.STRIPE_KEY;`,
      errors: [{ messageId: "ambientGlobalOutsideOwner" }],
    },
    {
      name: "an optional chain off the host, which wraps the read in a node of its own",
      filename: SERVICE,
      code: `export const key = globalThis?.process.env.STRIPE_KEY;`,
      errors: [{ messageId: "ambientGlobalOutsideOwner" }],
    },
    {
      name: "a quoted key in the destructure, which is not a computed one",
      filename: SERVICE,
      code: `const { "env": e } = require("node:process");\nexport const key = e.STRIPE_KEY;`,
      errors: [{ messageId: "ambientGlobalOutsideOwner" }],
    },
    {
      name: "a cast on the binding side rather than the read side",
      filename: SERVICE,
      code: `const proc = require("node:process") as never;\nexport const key = proc.env.STRIPE_KEY;`,
      errors: [{ messageId: "ambientGlobalOutsideOwner" }],
    },
    {
      name: "the loader's own ambient declaration, which declares it rather than rebinding it",
      filename: SERVICE,
      code: `declare function require(id: string): { env: Record<string, string> };\nexport const key = require("node:process").env.STRIPE_KEY;`,
      errors: [{ messageId: "ambientGlobalOutsideOwner" }],
    },
    {
      name: "the ambient loader spelled as a var, which is how @types/node declares it",
      filename: SERVICE,
      code: `declare var require: (id: string) => { env: Record<string, string> };\nexport const key = require("node:process").env.STRIPE_KEY;`,
      errors: [{ messageId: "ambientGlobalOutsideOwner" }],
    },
    {
      name: "a cast inside the await rather than around it",
      filename: SERVICE,
      code: `export const key = (await (import("node:process") as never)).env.STRIPE_KEY;`,
      errors: [{ messageId: "ambientGlobalOutsideOwner" }],
    },
    {
      name: "a rest element beside the capability, which names no key of its own",
      filename: SERVICE,
      code: `const { env, ...rest } = require("node:process");\nexport const key = [env.STRIPE_KEY, rest];`,
      errors: [{ messageId: "ambientGlobalOutsideOwner" }],
    },
    {
      name: "a backtick specifier, which is what a string-literal fence teaches people to write",
      filename: SERVICE,
      code: `const { env } = require(\`node:process\`);\nexport const key = env.STRIPE_KEY;`,
      errors: [{ messageId: "ambientGlobalOutsideOwner" }],
    },
    {
      name: "the host spellings of a bare global, which a name-only pattern misses",
      filename: SERVICE,
      code: `export const load = () => window.fetch("/api/a");\nexport const also = () => self["fetch"]("/api/b");`,
      errors: [
        { messageId: "ambientGlobalOutsideOwner" },
        { messageId: "ambientGlobalOutsideOwner" },
      ],
    },
    {
      name: "destructuring a bare global off its host introduces a local binding that reads nothing new",
      filename: SERVICE,
      code: `const { localStorage } = window;\nexport const token = localStorage.getItem("session");`,
      errors: [{ messageId: "ambientGlobalOutsideOwner" }],
    },
    {
      name: "TypeScript syntax wedges a node between the global and its property",
      filename: SERVICE,
      code: `const key = (process as never).env.STRIPE_KEY;\nconst token = (window as never).localStorage.getItem("session");`,
      errors: [
        { messageId: "ambientGlobalOutsideOwner" },
        { messageId: "ambientGlobalOutsideOwner" },
      ],
    },
    {
      name: "a declared environment resolves the globals out of the unresolved-reference list, where a rule reading only that list goes silent",
      filename: SERVICE,
      languageOptions: { env: { browser: true, node: true } },
      code: `export const key = process.env.STRIPE_KEY;\nexport const load = () => fetch("/api/invoices");`,
      errors: [
        { messageId: "ambientGlobalOutsideOwner" },
        { messageId: "ambientGlobalOutsideOwner" },
      ],
    },
    {
      name: "a file one segment away from the owning module is not the owning module",
      filename: "/repo/src/features/billing/env.ts",
      code: `export const key = process.env.STRIPE_KEY;`,
      errors: [{ messageId: "ambientGlobalOutsideOwner" }],
    },
    {
      name: "a name that merely starts like the API client does not inherit its exemption",
      filename: "/repo/src/infrastructure/api-client-legacy.ts",
      code: `export const load = () => fetch("/api/invoices");`,
      errors: [{ messageId: "ambientGlobalOutsideOwner" }],
    },
  ],

  legal: [
    {
      name: "a module that is not the capability's, however it is loaded",
      filename: SERVICE,
      code: `import path = require("node:path");\nconst { join } = require("node:path");\nexport const p = [path.sep, join("a", "b"), require("node:path").resolve("c")];`,
    },
    {
      name: "a local binding named require is not the module loader",
      filename: SERVICE,
      code: `export function boot(require: (id: string) => { env: Record<string, string> }) {\n  const { env } = require("node:process");\n  return env.STRIPE_KEY;\n}`,
    },
    {
      name: "an import-equals that aliases a local namespace loads no module at all",
      filename: SERVICE,
      code: `declare namespace NS { const env: Record<string, string>; }\nimport alias = NS;\nexport const key = alias.env.STRIPE_KEY;`,
    },
    {
      name: "the one module allowed to read env, which is the point of the rule",
      filename: "/repo/src/env.ts",
      code: `export const env = { stripeKey: process.env.STRIPE_KEY ?? "", publicUrl: import.meta.env.VITE_PUBLIC_URL ?? "" };`,
    },
    {
      name: "the API client is where fetch is configured",
      filename: "/repo/src/infrastructure/api-client.ts",
      code: `export const apiFetch = (path: string) => fetch(\`/api\${path}\`, { credentials: "include" });`,
    },
    {
      name: "the storage wrapper is where the throwing cases are handled",
      filename: "/repo/src/infrastructure/browser-storage.ts",
      code: `export const readToken = () => window.localStorage.getItem("session");`,
    },
    {
      name: "reading the validated config the env module exports",
      filename: SERVICE,
      code: `import { env } from "@/env";\nexport const charge = () => env.stripeKey;`,
    },
    {
      name: "calling the project's own wrapper rather than the global",
      filename: SERVICE,
      code: `import { apiFetch } from "@/infrastructure/api-client";\nexport const load = () => apiFetch("/invoices");`,
    },
    {
      name: "a fetch method on somebody else's client is a different API",
      filename: SERVICE,
      code: `import { client } from "@/infrastructure/api-client";\nexport const load = () => client.fetch("/invoices");`,
    },
    {
      name: "a property, a key and a type member are references to nothing",
      filename: SERVICE,
      code: `interface Transport { fetch: (path: string) => Promise<Response>; localStorage: string }\nconst transport = { fetch: undefined, localStorage: "memory" };\nexport const kind = transport.localStorage;`,
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
      name: "a different property of import.meta is not an environment read",
      filename: SERVICE,
      code: `export const here = import.meta.url;`,
    },
    {
      name: "node:process has exports that are not env",
      filename: SERVICE,
      code: `import { cwd } from "node:process";\nexport const here = cwd();`,
    },
    {
      name: "re-exporting and requiring the exports that are not env",
      filename: SERVICE,
      code: `export { cwd } from "node:process";\nconst { argv } = require("node:process");\nexport const args = argv;`,
    },
    {
      name: "a type-only import of env is erased and reads nothing",
      filename: SERVICE,
      code: `import type { env } from "node:process";\nexport type Env = typeof env;`,
    },
    {
      name: "a global nobody listed is a global this rule takes no stance on",
      filename: SERVICE,
      code: `export const id = crypto.randomUUID();\nexport const draft = sessionStorage.getItem("draft");`,
    },
    {
      name: "a test may read the environment it is setting up",
      filename: "/repo/src/features/billing/service/charge.test.ts",
      code: `const key = process.env.STRIPE_KEY;\nexport const load = () => fetch("/api/invoices");`,
    },
    {
      name: "what the build reads is a different question from what a running app believes",
      filename: "/repo/vite.config.ts",
      code: `export default { define: { mode: process.env.NODE_ENV } };`,
    },
  ],
});
