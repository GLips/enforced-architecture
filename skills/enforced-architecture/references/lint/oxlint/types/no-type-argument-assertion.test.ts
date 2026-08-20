import { describeRule } from "../lib/rule-spec.ts";
import { noTypeArgumentAssertionRule } from "./no-type-argument-assertion.ts";

const SERVICE = "/repo/src/features/billing/service/invoices.ts";
const COMPONENT = "/repo/src/features/billing/ui/invoice-list.tsx";

describeRule("types/no-type-argument-assertion", noTypeArgumentAssertionRule, {
  obvious: [
    {
      name: "a response body given a shape nothing checked",
      filename: SERVICE,
      code: `export async function loadInvoice(url: string): Promise<Invoice> {
  const response = await fetch(url);
  return response.json<Invoice>();
}`,
      errors: [{ messageId: "typeArgumentAssertion" }],
    },
    {
      name: "the tagged-template query this rule generalises",
      filename: SERVICE,
      code: `export const listInvoices = () => sql<InvoiceRow>\`select * from invoices\`;`,
      errors: [{ messageId: "typeArgumentAssertion" }],
    },
  ],

  adversarial: [
    {
      // The bare-identifier callee. A rule written against `api.get<T>` reads `node.callee` as a
      // MemberExpression and returns early on every free function.
      name: "a bare-identifier callee rather than a method",
      filename: SERVICE,
      code: `export const readConfig = (raw: string) => parse<InvoiceConfig>(raw);`,
      errors: [{ messageId: "typeArgumentAssertion" }],
    },
    {
      // One keystroke from the plain form, and invisible to a rule reading `property.name`.
      name: "the computed member spelling of the same client call",
      filename: SERVICE,
      code: `export const loadInvoice = (url: string) => client["get"]<Invoice>(url);`,
      errors: [{ messageId: "typeArgumentAssertion" }],
    },
    {
      // A non-null assertion between the call and its callee. The type argument is untouched and
      // the claim is identical, but `node.callee` is a TSNonNullExpression rather than the member
      // access — so a matcher reading the callee directly approves it.
      name: "a non-null assertion wedged between the call and its callee",
      filename: SERVICE,
      code: `export const loadInvoice = (url: string) => api.get!<Invoice>(url);`,
      errors: [{ messageId: "typeArgumentAssertion" }],
    },
    {
      name: "a type assertion on the callee itself",
      filename: SERVICE,
      code: `export const loadInvoice = (url: string) => (client.get as Getter)<Invoice>(url);`,
      errors: [{ messageId: "typeArgumentAssertion" }],
    },
    {
      // Parentheses are not a node in oxlint 1.77.0, so this reports through the plain path. Pinned
      // rather than assumed: if a future version starts surfacing them, this goes red instead of
      // the rule going quietly silent.
      name: "parentheses around the callee are not an escape",
      filename: SERVICE,
      code: `export const loadInvoice = (url: string) => (api.get)<Invoice>(url);`,
      errors: [{ messageId: "typeArgumentAssertion" }],
    },
    {
      name: "a non-null assertion on a template tag",
      filename: SERVICE,
      code: `export const listInvoices = () => sql!<InvoiceRow>\`select * from invoices\`;`,
      errors: [{ messageId: "typeArgumentAssertion" }],
    },
    {
      name: "an optional call, where the callee sits inside a chain",
      filename: SERVICE,
      code: `export const loadInvoice = async (response: Response) => response?.json<Invoice>();`,
      errors: [{ messageId: "typeArgumentAssertion" }],
    },
    {
      name: "the receiver is an awaited expression rather than a binding",
      filename: SERVICE,
      code: `export const loadInvoice = async (url: string) => (await fetch(url)).json<Invoice>();`,
      errors: [{ messageId: "typeArgumentAssertion" }],
    },
    {
      // The instantiation expression: the call is deferred by one line and the claim survives
      // intact. Not a CallExpression, so a rule built only around calls approves it — and this is
      // the shape that appears precisely once the call form starts being refused.
      name: "the type argument moved off the call onto a binding",
      filename: SERVICE,
      code: `const loadInvoice = client.get<Invoice>;
export const invoice = (url: string) => loadInvoice(url);`,
      errors: [{ messageId: "typeArgumentAssertion" }],
    },
    {
      // Refusing `unknown` alone would teach this on the retry, and it is strictly worse: the claim
      // is gone but so is every check downstream of it.
      name: "the any-valued variant, after unknown is offered as the escape",
      filename: SERVICE,
      code: `export const loadInvoice = (response: Response) => response.json<any>();`,
      errors: [{ messageId: "typeArgumentAssertion" }],
    },
    {
      name: "the asserted shape wrapped in a container type",
      filename: SERVICE,
      code: `export const loadInvoices = (response: Response) => response.json<Array<Invoice>>();`,
      errors: [{ messageId: "typeArgumentAssertion" }],
    },
    {
      name: "a deep receiver chain, where only the final name is the client method",
      filename: SERVICE,
      code: `export const loadInvoice = (deps: Deps, url: string) => deps.http.client.get<Invoice>(url);`,
      errors: [{ messageId: "typeArgumentAssertion" }],
    },
    {
      name: "a tagged template whose tag is a member expression",
      filename: SERVICE,
      code: `export const listInvoices = (db: Db) => db.sql<InvoiceRow>\`select * from invoices\`;`,
      errors: [{ messageId: "typeArgumentAssertion" }],
    },
    {
      name: "a second type argument does not dilute the first",
      filename: SERVICE,
      code: `export const runQuery = (db: Db) => db.query<InvoiceRow, QueryParams>("select 1");`,
      errors: [{ messageId: "typeArgumentAssertion" }],
    },
    {
      name: "spread across lines, where no single line reads as the banned call",
      filename: COMPONENT,
      code: `export const loadInvoice = (response: Response) => response.json<
  Invoice
>();`,
      errors: [{ messageId: "typeArgumentAssertion" }],
    },
    {
      name: "two asserting calls in one file are two findings, not one",
      filename: SERVICE,
      code: `export const loadInvoice = (url: string) => api.get<Invoice>(url);
export const saveInvoice = (url: string, body: Invoice) => api.post<InvoiceAck>(url, body);`,
      errors: [{ messageId: "typeArgumentAssertion" }, { messageId: "typeArgumentAssertion" }],
    },
  ],

  legal: [
    {
      // The whole point of the named list: this rule is not a ban on explicit type arguments, and a
      // version of it that reported here would be switched off within a day.
      name: "a type argument that annotates local state rather than external data",
      filename: COMPONENT,
      code: `export const useInvoice = () => useState<Invoice | null>(null);`,
    },
    {
      name: "a constructed collection carries its type argument legitimately",
      filename: SERVICE,
      code: `export const invoicesById = new Map<string, Invoice>();`,
    },
    {
      // Effect's real spelling, and the reason it is legal is stronger than the name list: the
      // schema arrives as a VALUE, so there is no type argument to be an assertion in the first
      // place. The spelling is Effect's own — `decodeUnknownSync(schema, options?)` is curried and
      // returns `(input: unknown) => A`, so a type argument never appears at the call site.
      name: "an Effect schema decoder takes the schema as a value, not a type argument",
      filename: SERVICE,
      code: `export const decodeInvoice = (raw: unknown) => Schema.decodeUnknownSync(Invoice)(raw);`,
    },
    {
      name: "the parse-at-the-boundary fix the message asks for",
      filename: SERVICE,
      code: `export const loadInvoice = async (response: Response) => invoiceSchema.parse(await response.json());`,
    },
    {
      name: "the unknown instantiation claims nothing and is the honest spelling",
      filename: SERVICE,
      code: `export const readBody = (response: Response) => response.json<unknown>();`,
    },
    {
      name: "a listed call with no type arguments at all",
      filename: SERVICE,
      code: `export const loadInvoice = (url: string) => api.get(url);`,
    },
    {
      // Exact-name matching, not substring: a project wanting its own wrapper covered adds the name
      // to the list rather than getting it by accident.
      name: "a project wrapper whose name merely contains a listed one",
      filename: SERVICE,
      code: `export const loadInvoices = (url: string) => fetchInvoiceRows<InvoiceRow>(url);`,
    },
    {
      // Why `all` is absent from the list even though `db.all<Row>()` exists: taking it would take
      // this with it, and here the type argument is a real annotation of a tuple the caller built.
      name: "Promise.all with an explicit tuple type argument",
      filename: SERVICE,
      code: `export const loadBoth = (a: Promise<Invoice>, b: Promise<Customer>) => Promise.all<[Invoice, Customer]>([a, b]);`,
    },
    {
      name: "an untagged query template asserts nothing",
      filename: SERVICE,
      code: `export const listInvoices = () => sql\`select * from invoices\`;`,
    },
    {
      name: "a test file may stub a client response however it likes",
      filename: "/repo/src/features/billing/service/invoices.test.ts",
      code: `const invoice = await response.json<Invoice>();`,
    },
    {
      name: "a one-off script is not shipped module graph",
      filename: "/repo/scripts/backfill-invoices.ts",
      code: `const rows = await sql<InvoiceRow>\`select * from invoices\`;`,
    },
  ],
});
