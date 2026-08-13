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
