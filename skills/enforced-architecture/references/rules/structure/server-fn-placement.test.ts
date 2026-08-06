import { describeRule } from "../lib/rule-spec.ts";
import { serverFnPlacementRule } from "./server-fn-placement.ts";

const SERVICE = "/repo/src/features/billing/service/charge.ts";
const ROUTE = "/repo/src/routes/dashboard.tsx";
const CONTROLLER = "/repo/src/features/billing/controllers/charge.ts";
const DEFINE = `export const charge = createServerFn().handler(async () => null);`;

describeRule("structure/server-fn-placement", serverFnPlacementRule, {
  obvious: [
    {
      name: "a server function defined in service/ rather than controllers/",
      filename: SERVICE,
      code: DEFINE,
      errors: [{ messageId: "serverFnOutsideControllers" }],
    },
    {
      name: "a route defining its own endpoint inline, where nobody looks for one",
      filename: ROUTE,
      code: `const load = createServerFn({ method: "GET" }).handler(async () => []);\nexport const Route = () => load;`,
      errors: [{ messageId: "serverFnOutsideControllers" }],
    },
    {
      name: "a shared utility standing in for infrastructure",
      filename: "/repo/src/shared/ui/uploader.tsx",
      code: `export const makeUploader = () => createServerFn({ method: "POST" }).handler(async () => null);`,
      errors: [{ messageId: "serverFnOutsideControllers" }],
    },
  ],

  adversarial: [
    {
      name: "aliasing the import renames every call site but not the imported name",
      filename: SERVICE,
      code: `import { createServerFn as makeEndpoint } from "@tanstack/react-start";\nexport const charge = makeEndpoint().handler(async () => null);`,
      errors: [{ messageId: "serverFnOutsideControllers" }],
    },
    {
      name: "reaching the factory through a namespace is not a bare call",
      filename: SERVICE,
      code: `import * as start from "@tanstack/react-start";\nexport const charge = start.createServerFn().handler(async () => null);`,
      errors: [{ messageId: "serverFnOutsideControllers" }],
    },
    {
      name: "the import and the definition are two separate mentions to remove",
      filename: SERVICE,
      code: `import { createServerFn } from "@tanstack/react-start";\n${DEFINE}`,
      errors: [
        { messageId: "serverFnOutsideControllers" },
        { messageId: "serverFnOutsideControllers" },
      ],
    },
    {
      name: "a second definition in the same file is a second violation, not a duplicate",
      filename: ROUTE,
      code: `const load = createServerFn({ method: "GET" }).handler(async () => []);\nconst save = createServerFn({ method: "POST" }).handler(async () => null);\nexport const Route = () => [load, save];`,
      errors: [
        { messageId: "serverFnOutsideControllers" },
        { messageId: "serverFnOutsideControllers" },
      ],
    },
    {
      name: "a directory that merely ends in 'controllers' is not the controllers layer",
      filename: "/repo/src/features/billing/legacy-controllers/charge.ts",
      code: DEFINE,
      errors: [{ messageId: "serverFnOutsideControllers" }],
    },
    {
      name: "a top-level controllers/ belongs to no feature and is not exempt",
      filename: "/repo/src/controllers/charge.ts",
      code: DEFINE,
      errors: [{ messageId: "serverFnOutsideControllers" }],
    },
  ],

  legal: [
    {
      name: "the controllers layer, importing and defining as many endpoints as it likes",
      filename: CONTROLLER,
      code: `import { createServerFn } from "@tanstack/react-start";\n${DEFINE}\nexport const list = createServerFn().handler(async () => []);`,
    },
    {
      name: "a subdirectory of controllers/ is still the controllers layer",
      filename: "/repo/src/features/billing/controllers/admin/refund.ts",
      code: DEFINE,
    },
    {
      name: "calling an endpoint from a component is the ordinary way to use one",
      filename: "/repo/src/features/billing/ui/panel.tsx",
      code: `import { charge } from "@/features/billing/controllers/charge";\nexport const Panel = () => charge();`,
    },
    {
      name: "a differently named factory is a different function",
      filename: SERVICE,
      code: `import { createServerFnClient } from "@/shared/rpc";\nexport const client = createServerFnClient();`,
    },
    {
      name: "the name inside a string is documentation, not a definition",
      filename: SERVICE,
      code: `export const guidance = "define createServerFn in controllers/";`,
    },
    {
      name: "a test may define an endpoint to exercise the seam",
      filename: "/repo/src/features/billing/service/charge.test.ts",
      code: DEFINE,
    },
    {
      name: "a one-off script sits outside the architecture contract",
      filename: "/repo/scripts/backfill.ts",
      code: DEFINE,
    },
  ],
});
