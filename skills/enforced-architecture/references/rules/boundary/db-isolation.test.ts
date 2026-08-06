import { describeRule } from "../lib/rule-spec.ts";
import { dbIsolationRule } from "./db-isolation.ts";

const UI = "/repo/src/features/billing/ui/table.tsx";
const SERVICE = "/repo/src/features/billing/service/charge.ts";
const IMPORT_DB = `import { db } from "@/infrastructure/db";`;

describeRule("boundary/db-isolation", dbIsolationRule, {
  obvious: [
    {
      name: "a service module reaching the DB directly",
      filename: SERVICE,
      code: IMPORT_DB,
      errors: [{ messageId: "dbOutsideDataLayer" }],
    },
    {
      name: "a UI component reaching the schema",
      filename: UI,
      code: `import { invoices } from "@/infrastructure/db/schema/invoices";`,
      errors: [{ messageId: "dbOutsideDataLayer" }],
    },
  ],

  adversarial: [
    {
      name: "a dynamic import is a call expression, not an import declaration",
      filename: SERVICE,
      code: `export const load = async () => (await import("@/infrastructure/db")).db;`,
      errors: [{ messageId: "dbOutsideDataLayer" }],
    },
    {
      name: "a re-export carries the same runtime dependency an import does",
      filename: SERVICE,
      code: `export { db } from "@/infrastructure/db";`,
      errors: [{ messageId: "dbOutsideDataLayer" }],
    },
    {
      name: "a star re-export names no binding to notice",
      filename: SERVICE,
      code: `export * from "@/infrastructure/db/schema/invoices";`,
      errors: [{ messageId: "dbOutsideDataLayer" }],
    },
    {
      name: "a type-only import still couples the layer to the schema's shape",
      filename: SERVICE,
      code: `import type { Invoice } from "@/infrastructure/db/schema/invoices";`,
      errors: [{ messageId: "dbOutsideDataLayer" }],
    },
    {
      name: "a directory that merely ends in 'repo' is not the repo layer",
      filename: "/repo/src/features/billing/legacy-repo/queries.ts",
      code: IMPORT_DB,
      errors: [{ messageId: "dbOutsideDataLayer" }],
    },
  ],

  legal: [
    { name: "the repo layer", filename: "/repo/src/features/billing/repo/queries.ts", code: IMPORT_DB },
    {
      name: "the controllers layer, for projects with no repo/",
      filename: "/repo/src/features/billing/controllers/list.ts",
      code: IMPORT_DB,
    },
    {
      name: "infrastructure IS the DB layer",
      filename: "/repo/src/infrastructure/db/client.ts",
      code: `import { drizzle } from "drizzle-orm/node-postgres";`,
    },
    { name: "the ORM config file", filename: "/repo/drizzle.config.ts", code: IMPORT_DB },
    {
      name: "a test may reach across every boundary",
      filename: "/repo/src/features/billing/service/charge.test.ts",
      code: IMPORT_DB,
    },
    {
      name: "a neighbouring infrastructure module is not the db module",
      filename: SERVICE,
      code: `import { logger } from "@/infrastructure/telemetry";`,
    },
    {
      name: "a specifier that merely starts with the db path is a different module",
      filename: SERVICE,
      code: `import { dbless } from "@/infrastructure/dbless";`,
    },
  ],
});
