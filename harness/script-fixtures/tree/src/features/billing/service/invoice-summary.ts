// The service layer, present so the SECOND bypass question gets asked of
// billing at all: controllers→repo is only a finding once service/ is occupied
// alongside repo/. The relative import here runs downward within one feature,
// which is the legitimate path the controllers are meant to take.
import { db } from "@/infrastructure/db/client.ts";
import { selectInvoiceRows } from "../repo/invoice-rows.ts";

export function summariseInvoices(accountId: string) {
  const rows = selectInvoiceRows(db, accountId);
  return { accountId, source: rows.table, settled: false };
}
