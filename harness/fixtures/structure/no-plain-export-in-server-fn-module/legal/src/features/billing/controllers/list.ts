import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { db } from "@/infrastructure/db";

export const list = createServerFn().handler(async () => db);
export const authed = createMiddleware().server(({ next }) => next());
export type InvoiceRow = { id: string };
export interface InvoiceFilter {
  paid: boolean;
}
export type { InvoiceId } from "./types";
type InvoiceState = "paid" | "open";
export type { InvoiceState };
export { type InvoiceState as LocalInvoiceState };
export { type RemoteInvoiceState } from "./types";

function formatCents(n: number) {
  return `${n / 100}`;
}
export const total = createServerFn().handler(async () => formatCents(1));
