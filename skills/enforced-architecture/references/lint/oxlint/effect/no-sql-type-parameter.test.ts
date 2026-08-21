import { describeRule } from "../lib/rule-spec.ts";
import { noSqlTypeParameterRule } from "./no-sql-type-parameter.ts";

const REPOSITORY = "/repo/src/features/billing/service/invoice-repository.ts";
const IMPORTS = `import { Effect } from "effect";\nimport { SqlClient } from "@effect/sql";\nimport { Invoice } from "@/features/billing/domain/invoice";`;

describeRule("effect/no-sql-type-parameter", noSqlTypeParameterRule, {
  obvious: [
    {
      name: "the row shape declared as a type parameter on the query",
      filename: REPOSITORY,
      code: `${IMPORTS}\nexport const listInvoices = Effect.gen(function* () {\n  const sql = yield* SqlClient.SqlClient;\n  return yield* sql<Invoice>\`select * from invoices\`;\n});`,
      errors: [{ messageId: "sqlTypeParameter" }],
    },
    {
      name: "an inline object type as the parameter",
      filename: REPOSITORY,
      code: `${IMPORTS}\nexport const listIds = Effect.gen(function* () {\n  const sql = yield* SqlClient.SqlClient;\n  return yield* sql<{ id: string }>\`select id from invoices\`;\n});`,
      errors: [{ messageId: "sqlTypeParameter" }],
    },
  ],

  adversarial: [
    {
      // The name sits first here rather than last, so a rule reading only the tag's final member
      // misses it — and this is the spelling that most wants catching, since `unsafe` has neither
      // validation nor escaping behind it.
      name: "the parameter on a helper hanging off the client",
      filename: REPOSITORY,
      code: `${IMPORTS}\nexport const listInvoices = Effect.gen(function* () {\n  const sql = yield* SqlClient.SqlClient;\n  return yield* sql.unsafe<Invoice>\`select * from invoices\`;\n});`,
      errors: [{ messageId: "sqlTypeParameter" }],
    },
    {
      name: "the client reached through another object, where the name sits last",
      filename: REPOSITORY,
      code: `${IMPORTS}\nimport { db } from "@/infrastructure/db";\nexport const listInvoices = db.sql<Invoice>\`select * from invoices\`;`,
      errors: [{ messageId: "sqlTypeParameter" }],
    },
    {
      // A non-null assertion between the template and its tag. The claim is untouched and the
      // source still reads `sql`, but `node.tag` is a TSNonNullExpression rather than the
      // identifier — so a matcher reading the tag directly approves it. This rule owns the name
      // alone, so approving it here approves it everywhere.
      name: "a non-null assertion wedged between the template and its tag",
      filename: REPOSITORY,
      code: `${IMPORTS}\nexport const listInvoices = () => sql!<Invoice>\`select * from invoices\`;`,
      errors: [{ messageId: "sqlTypeParameter" }],
    },
    {
      // The wrapper on the OTHER end: here it sits on the client the tag hangs off, so the name is
      // reached through the recursion rather than at the top. `unsafe` is deliberately the member,
      // because a member that matched on its own name would report either way and pin nothing.
      name: "a type assertion on the client, where the recursion is what has to step through it",
      filename: REPOSITORY,
      code: `${IMPORTS}\nexport const listInvoices = (sql as SqlClient.SqlClient).unsafe<Invoice>\`select * from invoices\`;`,
      errors: [{ messageId: "sqlTypeParameter" }],
    },
    {
      // This one carries extra weight: `types/no-type-argument-assertion` does not hold `sql` in
      // its call-name set, so a spelling missed here is missed everywhere rather than caught by
      // the other tag.
      name: "computed access to the client, where the tag has no identifier property",
      filename: REPOSITORY,
      code: `${IMPORTS}\nimport { db } from "@/infrastructure/db";\nexport const listInvoices = db["sql"]<Invoice>\`select * from invoices\`;`,
      errors: [{ messageId: "sqlTypeParameter" }],
    },
    {
      name: "the client held as a field on a class",
      filename: REPOSITORY,
      code: `${IMPORTS}\nexport class InvoiceRepository {\n  private readonly sql = SqlClient.SqlClient;\n  list() {\n    return this.sql<Invoice>\`select * from invoices\`;\n  }\n}`,
      errors: [{ messageId: "sqlTypeParameter" }],
    },
    {
      name: "a multi-line query, where no single line carries both the tag and the parameter",
      filename: REPOSITORY,
      code: `${IMPORTS}\nexport const listOverdue = (cutoff: Date) => sql<Invoice>\`\n  select *\n  from invoices\n  where due_at < \${cutoff}\n\`;`,
      errors: [{ messageId: "sqlTypeParameter" }],
    },
    {
      // The type argument moved off the template onto a binding. The template that later tags it
      // carries none, so a rule visiting only TaggedTemplateExpression reads the query as honest
      // and the claim rides the binding — and this is the shape that appears once the template
      // form starts being refused.
      name: "the type argument deferred onto a binding, leaving an untyped template behind",
      filename: REPOSITORY,
      code: `${IMPORTS}\nconst typedSql = sql<Invoice>;\nexport const listInvoices = () => typedSql\`select * from invoices\`;`,
      errors: [{ messageId: "sqlTypeParameter" }],
    },
    {
      name: "two typed queries in one repository are two unchecked claims",
      filename: REPOSITORY,
      code: `${IMPORTS}\nexport const listInvoices = sql<Invoice>\`select * from invoices\`;\nexport const findInvoice = (id: string) => sql<Invoice>\`select * from invoices where id = \${id}\`;`,
      errors: [{ messageId: "sqlTypeParameter" }, { messageId: "sqlTypeParameter" }],
    },
  ],

  legal: [
    {
      name: "an untyped query claims nothing about the rows it returns",
      filename: REPOSITORY,
      code: `${IMPORTS}\nexport const listInvoices = Effect.gen(function* () {\n  const sql = yield* SqlClient.SqlClient;\n  return yield* sql\`select * from invoices\`;\n});`,
    },
    {
      // The fix the message names: the shape is a Schema, so a renamed column fails at the query.
      name: "the query decoded through a schema",
      filename: REPOSITORY,
      code: `import { SqlClient, SqlSchema } from "@effect/sql";\nimport { Schema } from "effect";\nimport { Invoice } from "@/features/billing/domain/invoice";\nexport const findInvoice = SqlSchema.findOne({\n  Request: Schema.String,\n  Result: Invoice,\n  execute: (id) => sql\`select * from invoices where id = \${id}\`,\n});`,
    },
    {
      name: "a different tagged template with a type parameter is a different API",
      filename: "/repo/src/features/billing/ui/invoice-list.tsx",
      code: `import { gql } from "@apollo/client";\nexport const invoiceQuery = gql<{ invoices: ReadonlyArray<{ id: string }> }>\`query { invoices { id } }\`;`,
    },
    {
      name: "a plain string named sql is not a tagged template",
      filename: REPOSITORY,
      code: `${IMPORTS}\nexport const statement = "select * from invoices";`,
    },
    {
      // The seam the header states, pinned so it stays a decision rather than becoming an
      // accident: on a CALL the type argument has a second honest reading — `sql.begin<T>(cb)`
      // annotates what the callback returns, not a row shape — so the call form is left alone by
      // this rule and by `types/no-type-argument-assertion`, which reads `begin` as the name.
      name: "a type argument on a sql helper CALL annotates a return, not a row shape",
      filename: REPOSITORY,
      code: `${IMPORTS}\nexport const transfer = (sql: SqlClient.SqlClient) => sql.begin<Invoice>((tx) => tx\`select 1\`);`,
    },
    {
      name: "a test may pin a query's shape while a migration is in flight",
      filename: "/repo/src/features/billing/service/invoice-repository.test.ts",
      code: `${IMPORTS}\nconst rows = sql<Invoice>\`select * from invoices\`;`,
    },
    {
      name: "a one-off script is not the shipped module graph",
      filename: "/repo/scripts/backfill-invoices.ts",
      code: `${IMPORTS}\nconst rows = sql<Invoice>\`select * from invoices\`;`,
    },
  ],
});
