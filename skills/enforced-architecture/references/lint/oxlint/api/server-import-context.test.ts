import { describeRule } from "../lib/rule-spec.ts";
import { serverImportContextRule } from "./server-import-context.ts";

const UI = "/repo/src/features/billing/ui/panel.tsx";
const SHARED_UI = "/repo/src/shared/ui/summary.tsx";
const IMPORT_SERVER_BARREL = `import { chargeCard } from "@/features/billing/index.server";`;

describeRule("api/server-import-context", serverImportContextRule, {
  obvious: [
    {
      name: "a client-context component importing a feature's server barrel",
      filename: UI,
      code: IMPORT_SERVER_BARREL,
      errors: [{ messageId: "serverBarrelInClientContext" }],
    },
    {
      name: "route files are isomorphic and cannot reach a server barrel",
      filename: "/repo/src/routes/dashboard.tsx",
      code: IMPORT_SERVER_BARREL,
      errors: [{ messageId: "serverBarrelInClientContext" }],
    },
  ],

  adversarial: [
    {
      name: "a relative path to a server barrel, where a pattern anchored on the alias would miss",
      filename: SHARED_UI,
      code: `import { auditLog } from "../../features/billing/index.server";`,
      errors: [{ messageId: "serverBarrelInClientContext" }],
    },
    {
      name: "a dynamic import is a call expression, not an import declaration",
      filename: SHARED_UI,
      code: `export const lazyCharge = async () => (await import("@/features/billing/index.server")).chargeCard;`,
      errors: [{ messageId: "serverBarrelInClientContext" }],
    },
    {
      name: "a re-export pushes the server barrel through the client module just the same",
      filename: SHARED_UI,
      code: `export { refund } from "@/features/checkout/index.server";`,
      errors: [{ messageId: "serverBarrelInClientContext" }],
    },
    {
      name: "a star re-export names no binding to notice",
      filename: SHARED_UI,
      code: `export * from "@/domains/pricing/index.server";`,
      errors: [{ messageId: "serverBarrelInClientContext" }],
    },
    {
      name: "a type-only import of the server barrel still pulls the module into the client graph",
      filename: UI,
      code: `import type { Charge } from "@/features/billing/index.server";\nexport const charges: Charge[] = [];`,
      errors: [{ messageId: "serverBarrelInClientContext" }],
    },
    {
      name: "a directory that merely ends in a server layer's name is still a client context",
      filename: "/repo/src/features/billing/legacy-service/charge.ts",
      code: IMPORT_SERVER_BARREL,
      errors: [{ messageId: "serverBarrelInClientContext" }],
    },
  ],

  legal: [
    {
      name: "the controllers layer is a server context",
      filename: "/repo/src/features/billing/controllers/charge.ts",
      code: `import { auditLog } from "@/features/audit/index.server";`,
    },
    {
      name: "the repo layer is a server context",
      filename: "/repo/src/features/billing/repo/totals.ts",
      code: IMPORT_SERVER_BARREL,
    },
    {
      name: "the service layer is a server context",
      filename: "/repo/src/features/billing/service/charge.ts",
      code: IMPORT_SERVER_BARREL,
    },
    {
      name: "infrastructure is a server context",
      filename: "/repo/src/infrastructure/mailer/send.ts",
      code: IMPORT_SERVER_BARREL,
    },
    {
      name: "a .server.ts file is server-only whatever directory it sits in",
      filename: "/repo/src/features/billing/ui/loader.server.ts",
      code: IMPORT_SERVER_BARREL,
    },
    {
      name: "a route names itself a server context, which is the only way routes/ gets one — boundary/route-thinness has no arm here for exactly this reason",
      filename: "/repo/src/routes/api.invoices.server.ts",
      code: IMPORT_SERVER_BARREL,
    },
    {
      name: "a module whose name merely starts with the server barrel's",
      filename: UI,
      code: `import { SERVER_TIMEOUT_MS } from "@/features/billing/index.server-config";`,
    },
    {
      name: "the client-safe barrel is what a client context is meant to import",
      filename: UI,
      code: `import { billingLabel } from "@/features/billing";`,
    },
    {
      name: "a test may reach across every boundary",
      filename: "/repo/src/features/billing/ui/panel.test.tsx",
      code: IMPORT_SERVER_BARREL,
    },
  ],
});
