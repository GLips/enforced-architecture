import { describeRule } from "../lib/rule-spec.ts";
import { routeThinnessRule } from "./route-thinness.ts";

const ROUTE = "/repo/src/routes/invoices.tsx";
const NESTED_ROUTE = "/repo/src/routes/admin/settings.tsx";
const IMPORT_DB = `import { db } from "@/infrastructure/db";`;

describeRule("boundary/route-thinness", routeThinnessRule, {
  obvious: [
    {
      name: "a route reaching straight past the feature layer to the DB",
      filename: ROUTE,
      code: IMPORT_DB,
      errors: [{ messageId: "serverOnlyImportInRoute" }],
    },
    {
      name: "a route reading server-only env, which is a secret in the transport layer",
      filename: ROUTE,
      code: `import { serverEnv } from "@/env.server";`,
      errors: [{ messageId: "serverOnlyImportInRoute" }],
    },
  ],

  adversarial: [
    {
      name: "a dynamic import is a call expression, not an import declaration",
      filename: ROUTE,
      code: `export const loader = async () => (await import("@/env.server")).serverEnv;`,
      errors: [{ messageId: "serverOnlyImportInRoute" }],
    },
    {
      name: "a re-export carries the same runtime dependency an import does",
      filename: ROUTE,
      code: `export { serverEnv } from "@/env.server";`,
      errors: [{ messageId: "serverOnlyImportInRoute" }],
    },
    {
      name: "a star re-export names no binding to notice",
      filename: ROUTE,
      code: `export * from "@/infrastructure/db/schema/invoices";`,
      errors: [{ messageId: "serverOnlyImportInRoute" }],
    },
    {
      name: "a type-only import still couples the route to the schema's shape",
      filename: ROUTE,
      code: `import type { Invoice } from "@/infrastructure/db/schema/invoices";`,
      errors: [{ messageId: "serverOnlyImportInRoute" }],
    },
    {
      name: "the DB module has subpaths, so matching the client module alone misses the schema",
      filename: NESTED_ROUTE,
      code: `import { invoices } from "@/infrastructure/db/schema/invoices";`,
      errors: [{ messageId: "serverOnlyImportInRoute" }],
    },
    {
      name: "a route nested two directories deep is still the transport layer",
      filename: NESTED_ROUTE,
      code: IMPORT_DB,
      errors: [{ messageId: "serverOnlyImportInRoute" }],
    },
  ],

  legal: [
    {
      name: "the client-safe feature barrel, which is how a route is meant to get data",
      filename: ROUTE,
      code: `import { billingLabel } from "@/features/billing";`,
    },
    {
      name: "the client env module, which carries nothing secret",
      filename: ROUTE,
      code: `import { env } from "@/env.client";`,
    },
    {
      name: "an infrastructure module whose name merely starts like the DB one",
      filename: ROUTE,
      code: `import { dbtLogger } from "@/infrastructure/dbt-logger";`,
    },
    {
      name: "an env module whose name merely starts like the server one",
      filename: ROUTE,
      code: `import { flags } from "@/env.server-flags";`,
    },
    {
      name: "a directory that merely starts with 'routes' is not the routes layer",
      filename: "/repo/src/routes-legacy/invoices.tsx",
      code: IMPORT_DB,
    },
    {
      name: "the service layer, which is allowed the dependencies a route is not",
      filename: "/repo/src/features/billing/service/charge.ts",
      code: `import { serverEnv } from "@/env.server";`,
    },
    {
      name: "a route's test may reach across every boundary",
      filename: "/repo/src/routes/invoices.test.tsx",
      code: IMPORT_DB,
    },
    {
      name: "an external package that happens to be named after the alias root",
      filename: ROUTE,
      code: `import { connect } from "@infrastructure/db";`,
    },
  ],
});
