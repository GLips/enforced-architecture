import { describeRule } from "../lib/rule-spec.ts";
import { noVacantSymbolNamesRule } from "./no-vacant-symbol-names.ts";

const SERVICE = "/repo/src/features/billing/service/invoices.ts";

describeRule("naming/no-vacant-symbol-names", noVacantSymbolNamesRule, {
  obvious: [
    {
      name: "the interface suffix the rule was generalised from",
      filename: SERVICE,
      code: `export interface InvoiceShape { id: string }`,
      errors: [{ messageId: "vacantName" }],
    },
    {
      name: "a type alias named for its container category",
      filename: SERVICE,
      code: `export type InvoiceData = { id: string };`,
      errors: [{ messageId: "vacantName" }],
    },
  ],

  adversarial: [
    {
      name: "snake_case is split the same way as camelCase",
      filename: SERVICE,
      code: `export const invoice_info = load();`,
      errors: [{ messageId: "vacantName" }],
    },
    {
      name: "a screaming-snake constant",
      filename: SERVICE,
      code: `export const DEFAULT_INVOICE_DATA = {};`,
      errors: [{ messageId: "vacantName" }],
    },
    {
      name: "consecutive capitals, where a naive split loses the word boundary",
      filename: SERVICE,
      code: `export type APIData = { id: string };`,
      errors: [{ messageId: "vacantName" }],
    },
    {
      name: "the term leading rather than trailing",
      filename: SERVICE,
      code: `export class DataLoader {}`,
      errors: [{ messageId: "vacantName" }],
    },
    {
      name: "a class named for managing rather than for a boundary",
      filename: SERVICE,
      code: `export class BillingManager {}`,
      errors: [{ messageId: "vacantName" }],
    },
    {
      name: "an enum declaration",
      filename: SERVICE,
      code: `export enum InvoiceInfo { Draft }`,
      errors: [{ messageId: "vacantName" }],
    },
    {
      name: "declared without export, and still an address at module level",
      filename: SERVICE,
      code: `type InvoiceShape = { id: string };`,
      errors: [{ messageId: "vacantName" }],
    },
    {
      name: "an arrow function assigned to a module-level const",
      filename: SERVICE,
      code: `export const loadInvoiceData = () => read();`,
      errors: [{ messageId: "vacantName" }],
    },
    {
      // The exclusion beside this one is two CONSTRUCTS, not the `declare` keyword — and matched on
      // the keyword alone this case joins them silently. `App` is the project's namespace, so both
      // the name and the fix are its own.
      name: "an ambient namespace the project owns, which the module and global exclusion does not reach",
      filename: SERVICE,
      code: `declare namespace App {
  const data: string;
}`,
      errors: [{ messageId: "vacantName" }],
    },
    {
      // A namespace body is transparent to the position test, because `Billing.data` is an address
      // in exactly the sense the header means. Both halves are in one fixture on purpose: the type
      // arms ask no position question at all, so treating the namespace as a boundary makes the
      // rule give two answers about one block — and only a fixture holding both can see that.
      name: "a namespace member, reachable as N.name and named by the same test as the type beside it",
      filename: SERVICE,
      code: `export namespace Billing {
  export const data = 1;
  export type Info = { id: string };
}`,
      errors: [{ messageId: "vacantName" }, { messageId: "vacantName" }],
    },
    {
      name: "two vacant declarations are two findings",
      filename: SERVICE,
      code: `export type InvoiceShape = { id: string };
export type InvoiceInfo = { total: number };`,
      errors: [{ messageId: "vacantName" }, { messageId: "vacantName" }],
    },
  ],

  legal: [
    {
      // Whole-word matching is the whole rule. A substring test — which is what the upstream rule
      // this generalises uses — flags all three of these, and each false positive reads as the
      // rule being broken rather than the name being bad.
      name: "a word merely containing a banned term is not the term",
      filename: SERVICE,
      code: `export function reshape(rows: InvoiceRow[]): InvoiceRow[] { return rows; }
export type Metadata = { revision: number };
export const database = connect();`,
    },
    {
      // The fix the message asks for: each name says which layer owns the representation.
      name: "names that record which layer owns the representation",
      filename: SERVICE,
      code: `export type InvoiceRow = { id: string };
export type CreateInvoiceInput = { total: number };
export type InvoiceResponse = { id: string };`,
    },
    {
      // A rule visiting every Identifier reports here, and the name cannot be changed. That is the
      // failure that guarantees the rule gets turned off.
      name: "an imported third-party name is not this project's to rename",
      filename: SERVICE,
      code: `import { DataGrid } from "@vendor/tables";
export const grid = DataGrid;`,
    },
    {
      name: "a reference to a vacant name declared elsewhere is not a declaration",
      filename: SERVICE,
      code: `export function render(): void { draw(chartData); }`,
    },
    {
      // The type arm asks no position question, so it reaches an ambient block on its own terms —
      // and a type in `declare module "@vendor/x"` is as unrenamable as the const beside it. Both
      // halves are here because one exclusion covers both, and a fixture naming one would let the
      // other silently diverge.
      name: "a module augmentation describes a package's names, which are not the project's to rename",
      filename: SERVICE,
      code: `declare module "@vendor/tables" {
  export const data: string;
  export type Info = { id: string };
}`,
    },
    {
      name: "a declare global block names the host's globals, not this project's",
      filename: SERVICE,
      code: `declare global {
  const data: string;
}`,
    },
    {
      name: "a local binding inside a function body is not an address",
      filename: SERVICE,
      code: `export function summarise(rows: InvoiceRow[]): number {
  const data = rows.map((row) => row.total);
  return data.length;
}`,
    },
    {
      name: "base carries real meaning and is deliberately not banned",
      filename: SERVICE,
      code: `export class BaseInvoice {}`,
    },
    {
      name: "an object property is dictated by the payload, not by us",
      filename: SERVICE,
      code: `export const response = { data: rows, cursor: null };`,
    },
    {
      name: "a test file names fixtures however it likes",
      filename: "/repo/src/features/billing/service/invoices.test.ts",
      code: `type FixtureShape = { id: string };`,
    },
    {
      name: "a one-off script is not shipped module graph",
      filename: "/repo/scripts/backfill-invoices.ts",
      code: `const rowData = read();`,
    },
  ],
});
