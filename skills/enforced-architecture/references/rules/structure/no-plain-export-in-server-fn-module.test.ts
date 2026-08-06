import { describeRule } from "../lib/rule-spec.ts";
import { noPlainExportInServerFnModuleRule } from "./no-plain-export-in-server-fn-module.ts";

const CONTROLLERS = "/repo/src/features/billing/controllers/charge.ts";
const BRIDGE = `export const charge = createServerFn({ method: "POST" }).handler(async () => 1);`;

/** Every case below shares the module shape the rule gates on: a file that defines a bridge. */
const inBridgeModule = (name: string, code: string) => ({
  name,
  filename: CONTROLLERS,
  code: `import { createServerFn } from "@tanstack/react-start";\n${BRIDGE}\n${code}`,
});

/** A spelling that must fire exactly once, as the plain runtime-export leak. */
const leaks = (name: string, code: string) => ({
  ...inBridgeModule(name, code),
  errors: [{ messageId: "runtimeExportLeak" }],
});

describeRule(
  "structure/no-plain-export-in-server-fn-module",
  noPlainExportInServerFnModuleRule,
  {
    obvious: [
      leaks(
        "a plain helper exported beside a server function",
        `export function formatCents(n: number) { return n / 100; }`,
      ),
      leaks(
        "an exported object carries whatever its properties close over",
        `export const policy = { getSession: auth.api.getSession };`,
      ),
      leaks(
        "an async function with a return-type annotation is still a runtime export",
        `export async function reload(): Promise<void> {}`,
      ),
    ],

    adversarial: [
      leaks(
        "a star re-export names no binding to notice",
        `export * from "./roles.server";`,
      ),
      leaks("an enum emits a runtime object, unlike every other TS declaration", `export enum Tier { Free }`),
      leaks(
        "a leak riding along in a second declarator behind an exempt first one",
        `export const okBridge = createServerFn().handler(async () => 1), sneaky = readSecret();`,
      ),
      leaks(
        "a bridge behind a mutable binding can be reassigned to anything after the declaration",
        `export let mutableBridge = createServerFn().handler(async () => 1);`,
      ),
      leaks(
        "a value specifier riding alongside an inline type one",
        `type SessionReader = () => void;\nconst readSession = () => auth.api.getSession;\nexport { type SessionReader, readSession };`,
      ),
      leaks(
        "the declaration and the export are separate statements, so the export clause carries no shape",
        `const laterHelper = () => auth.api.getSession;\nexport { laterHelper };`,
      ),
      leaks(
        "a bridge nested inside an arrow is a function that leaks, not a bridge",
        `export const makeCharge = () => createServerFn().handler(async () => 1);`,
      ),
      {
        ...inBridgeModule(
          "a default-exported bridge, which the compiler cannot resolve to a declarator",
          `export default createMiddleware().server(({ next }) => next());`,
        ),
        errors: [{ messageId: "defaultBridgeExport" }],
      },
    ],

    legal: [
      {
        name: "a module with no bridge in it is not this rule's business",
        filename: "/repo/src/features/billing/service/format.ts",
        code: `export function formatCents(n: number) { return n / 100; }`,
      },
      {
        name: "the .server.ts sibling is the sanctioned home for all of this",
        filename: "/repo/src/features/billing/controllers/audit.server.ts",
        code: `import { createServerFn } from "@tanstack/react-start";\n${BRIDGE}\nexport const secret = readSecret();`,
      },
      inBridgeModule(
        "types and interfaces are erased before the bundle exists",
        `export type InvoiceRow = { id: string };\nexport interface InvoiceFilter { paid: boolean }`,
      ),
      inBridgeModule(
        "a type-only re-export carries no runtime binding",
        `export type { InvoiceId } from "./types";\nexport { type RemoteInvoiceState } from "./types";`,
      ),
      inBridgeModule(
        "an inline type specifier in a local clause is erased too",
        `type InvoiceState = "paid" | "open";\nexport { type InvoiceState };`,
      ),
      inBridgeModule(
        "a type annotation between the name and the initializer does not stop it being a bridge",
        `export const total: ServerFn<number> = createServerFn().handler(async () => 2);`,
      ),
      inBridgeModule(
        "a satisfies suffix does not stop it being a bridge either",
        `export const authed = createMiddleware().server(({ next }) => next()) satisfies Bridge;`,
      ),
      inBridgeModule(
        "an ambient declaration emits nothing",
        `export declare const buildStamp: string;`,
      ),
      {
        name: "a test file may export whatever it needs to exercise the seam",
        filename: "/repo/src/features/billing/controllers/charge.test.ts",
        code: `import { createServerFn } from "@tanstack/react-start";\n${BRIDGE}\nexport const fixture = { id: "1" };`,
      },
    ],
  },
);
