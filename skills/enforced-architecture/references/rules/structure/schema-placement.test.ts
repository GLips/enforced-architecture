import { describeRule } from "../lib/rule-spec.ts";
import { schemaPlacementRule } from "./schema-placement.ts";

const REPO = "/repo/src/features/billing/repo/queries.ts";
const SERVICE = "/repo/src/features/billing/service/model.ts";
const TABLE = `export const invoices = pgTable("invoices", { id: text("id") });`;

describeRule("structure/schema-placement", schemaPlacementRule, {
  obvious: [
    {
      name: "a table declared in a feature's repo layer instead of the schema directory",
      filename: REPO,
      code: TABLE,
      errors: [{ messageId: "schemaOutsideSchemaDirectory" }],
    },
    {
      name: "a relations declaration, the second half of a Drizzle data model",
      filename: SERVICE,
      code: `export const invoiceRelations = relations(invoices, ({ one }) => ({}));`,
      errors: [{ messageId: "schemaOutsideSchemaDirectory" }],
    },
  ],

  adversarial: [
    {
      name: "a call spread across lines, where a single-line pattern loses the shape",
      filename: SERVICE,
      code: `export const lineItems = pgTable(\n  "line_items",\n  { id: text("id") },\n);`,
      errors: [{ messageId: "schemaOutsideSchemaDirectory" }],
    },
    {
      name: "a second declaration in the same file is a second violation, not a duplicate",
      filename: SERVICE,
      code: `export const lineItems = pgTable("line_items", {});\nexport const taxRows = pgTable("tax_rows", {});`,
      errors: [
        { messageId: "schemaOutsideSchemaDirectory" },
        { messageId: "schemaOutsideSchemaDirectory" },
      ],
    },
    {
      name: "a table built inside a factory function, where a top-level scan sees nothing",
      filename: SERVICE,
      code: `export function makeAuditTable(name: string) {\n  return pgTable(name, { id: text("id") });\n}`,
      errors: [{ messageId: "schemaOutsideSchemaDirectory" }],
    },
    {
      name: "a table buried as an object property rather than bound to a name",
      filename: SERVICE,
      code: `export const registry = { invoices: pgTable("invoices", { id: text("id") }) };`,
      errors: [{ messageId: "schemaOutsideSchemaDirectory" }],
    },
    {
      name: "a directory that merely starts like the schema directory is not it",
      filename: "/repo/src/infrastructure/db/schema-archive/invoices.ts",
      code: TABLE,
      errors: [{ messageId: "schemaOutsideSchemaDirectory" }],
    },
    {
      name: "a directory that merely starts like the migration output is ordinary source",
      filename: "/repo/src/features/billing/drizzle-helpers/seed.ts",
      code: TABLE,
      errors: [{ messageId: "schemaOutsideSchemaDirectory" }],
    },
  ],

  legal: [
    {
      name: "the schema directory is where declarations belong",
      filename: "/repo/src/infrastructure/db/schema/invoices.ts",
      code: `${TABLE}\nexport const invoiceRelations = relations(invoices, ({ one }) => ({}));`,
    },
    {
      name: "a nested schema file inherits the directory's exemption",
      filename: "/repo/src/infrastructure/db/schema/billing/invoices.ts",
      code: TABLE,
    },
    {
      name: "generated migrations legitimately restate the tables",
      filename: "/repo/drizzle/0001_init.ts",
      code: TABLE,
    },
    {
      name: "importing the schema is what every repo does — only declaring it is restricted",
      filename: REPO,
      code: `import { invoices } from "@/infrastructure/db/schema/invoices";\nimport { db } from "@/infrastructure/db";\nexport const list = () => db.select().from(invoices);`,
    },
    {
      name: "identifiers that merely contain the declaration names are not calls to them",
      filename: REPO,
      code: `const pgTableName = "invoices";\nconst buildRelationsMap = () => ({});\nexport const meta = [pgTableName, buildRelationsMap];`,
    },
    {
      name: "a method named relations on some other builder is not a Drizzle declaration",
      filename: REPO,
      code: `export const withRelations = (qb) => qb.relations("invoices");`,
    },
    {
      name: "a test may build a throwaway table to exercise a query",
      filename: "/repo/src/features/billing/repo/queries.test.ts",
      code: TABLE,
    },
    {
      name: "a seed script sits outside the architecture contract",
      filename: "/repo/scripts/seed.ts",
      code: TABLE,
    },
  ],
});
