import { describeRule } from "../lib/rule-spec.ts";
import { noRawResultRule } from "./no-raw-result.ts";

const REPO = "/repo/src/features/billing/repo/queries.ts";
const CONTROLLERS = "/repo/src/features/billing/controllers/write.ts";
const INFRASTRUCTURE = "/repo/src/infrastructure/db/writes.ts";

describeRule("placement/no-raw-result", noRawResultRule, {
  obvious: [
    {
      name: "a delete returned straight to the caller, with no .returning()",
      filename: REPO,
      code: `export function deleteInvoice(id: string) {\n  return db.delete(invoices).where(eq(invoices.id, id));\n}`,
      errors: [{ messageId: "rawWriteReturned" }],
    },
    {
      name: "an update from the controllers layer, which is in scope when there is no repo/",
      filename: CONTROLLERS,
      code: `export async function markPaid(id: string) {\n  return db.update(invoices).set({ paid: true }).where(eq(invoices.id, id));\n}`,
      errors: [{ messageId: "rawWriteReturned" }],
    },
  ],

  adversarial: [
    {
      name: "the insert path, which a delete-only pattern misses entirely",
      filename: CONTROLLERS,
      code: `export async function upsertInvoice(id: string) {\n  return db.insert(invoices).values({ id }).onConflictDoNothing();\n}`,
      errors: [{ messageId: "rawWriteReturned" }],
    },
    {
      // The position that only a SHARED profile list covers. `boundary/db-isolation` allows the db
      // here, so this is where a raw write is legal to build — and a rule holding its own shorter
      // list is silent on the way out, with nothing between the write and the serializer.
      name: "the infrastructure layer, where the db is legal and the write result still cannot ship",
      filename: INFRASTRUCTURE,
      code: `export function purge(id: string) {\n  return db.delete(invoices).where(eq(invoices.id, id));\n}`,
      errors: [{ messageId: "rawWriteReturned" }],
    },
    {
      name: "an await between the return and the chain hides nothing",
      filename: REPO,
      code: `export async function purge(id: string) {\n  return await db\n    .delete(invoices)\n    .where(eq(invoices.id, id));\n}`,
      errors: [{ messageId: "rawWriteReturned" }],
    },
    {
      name: "two writes in one file are two findings, which needs per-match scoping",
      filename: REPO,
      code: `export function purge(id: string) {\n  return db.delete(invoices).where(eq(invoices.id, id));\n}\nexport function purgeAll() {\n  return db.delete(invoices);\n}`,
      errors: [{ messageId: "rawWriteReturned" }, { messageId: "rawWriteReturned" }],
    },
    {
      name: "an expression-bodied arrow returns its expression with no return statement to find",
      filename: REPO,
      code: `export const purgeLater = (id: string) => db.delete(invoices).where(eq(invoices.id, id));`,
      errors: [{ messageId: "rawWriteExpressionBody" }],
    },
    {
      name: "a return-type annotation sits between the params and the body",
      filename: REPO,
      code: `export const purgeTyped = async (id: string): Promise<unknown> =>\n  db.delete(invoices).where(eq(invoices.id, id));`,
      errors: [{ messageId: "rawWriteExpressionBody" }],
    },
    {
      name: "a .returning() belonging to a subquery does not sanitize the outer write",
      filename: REPO,
      code: `export function purgeStale() {\n  return db.delete(invoices).where(inArray(invoices.id, stale.returning()));\n}`,
      errors: [{ messageId: "rawWriteReturned" }],
    },
    {
      name: "a safe first branch of a ternary does not mask the write behind it",
      filename: REPO,
      code: `export function purgeMaybe(id: string, hard: boolean) {\n  return hard ? db.delete(invoices).returning() : db.delete(invoices).where(eq(invoices.id, id));\n}`,
      errors: [{ messageId: "rawWriteReturned" }],
    },
    {
      name: "a returned arrow is one finding, at the arrow — the return itself yields a function",
      filename: REPO,
      code: `export function makePurge() {\n  return () => db.delete(invoices);\n}`,
      errors: [{ messageId: "rawWriteExpressionBody" }],
    },
  ],

  legal: [
    {
      name: ".returning() converts the driver Result into plain rows",
      filename: REPO,
      code: `export function deleteInvoice(id: string) {\n  return db.delete(invoices).where(eq(invoices.id, id)).returning();\n}\nexport function upsertInvoice(id: string) {\n  return db.insert(invoices).values({ id }).onConflictDoNothing().returning();\n}`,
    },
    {
      name: "awaiting without returning gives the caller Promise<void>",
      filename: REPO,
      code: `export async function purge(id: string) {\n  await db.delete(invoices).where(eq(invoices.id, id));\n}`,
    },
    {
      name: "a read has no driver Result to leak",
      filename: REPO,
      code: `export function listInvoices() {\n  return db.select().from(invoices);\n}`,
    },
    {
      name: "a relational read bottoms out in a property chain, not the client",
      filename: REPO,
      code: `export const findInvoices = () => db.query.invoices.findMany();`,
    },
    {
      name: "the same method name on something that is not the db client",
      filename: REPO,
      code: `export function evict(id: string) {\n  return invoiceCache.delete(id);\n}`,
    },
    {
      name: "service/ is outside DATA_ACCESS_PROFILES, so the db reaching it is boundary/db-isolation's finding",
      filename: "/repo/src/features/billing/service/charge.ts",
      code: `export function deleteInvoice() {\n  return db.delete(invoices);\n}`,
    },
    {
      name: "a directory that merely ends in 'repo' is not the repo layer",
      filename: "/repo/src/features/billing/legacy-repo/queries.ts",
      code: `export function deleteInvoice() {\n  return db.delete(invoices);\n}`,
    },
    {
      name: "a test file may assert on the raw driver Result",
      filename: "/repo/src/features/billing/repo/queries.test.ts",
      code: `export function deleteInvoice() {\n  return db.delete(invoices);\n}`,
    },
  ],
});
