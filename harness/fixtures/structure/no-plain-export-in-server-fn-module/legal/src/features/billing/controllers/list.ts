import { createServerFn } from "@tanstack/react-start";
import { db } from "@/infrastructure/db";

// Server functions themselves, and the types and constants beside them, are
// what a controller module is for. Only plain exported FUNCTIONS leak.
export const list = createServerFn().handler(async () => db);
export type InvoiceRow = { id: string };
export const PAGE_SIZE = 50;

// A non-exported helper stays in the module and is pruned with the handler.
function formatCents(n: number) {
  return `${n / 100}`;
}
export const total = createServerFn().handler(async () => formatCents(1));

// NEGATIVE SPACE, named in the template: a function exported on a later line
// is a known bypass. Correlating the declaration with the export list by name
// is beyond a per-file GritQL pattern, so this is deliberately not reported.
function formatDollars(n: number) {
  return `$${n / 100}`;
}
export { formatDollars };
