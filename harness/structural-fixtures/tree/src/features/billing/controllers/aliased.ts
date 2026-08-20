// FIRES layer-occupancy: the service bypass written as a same-feature alias.
//
// `@/features/billing/repo/…` from inside `features/billing` contains no `../`
// at all, so a relative-only matcher never sees it — and this is the spelling
// an editor's auto-import offers first. The aliased and the relative form name
// one module; only the resolved target makes them one edge.
import { selectInvoiceRows } from "@/features/billing/repo/invoice-rows.ts";
import { db } from "@/infrastructure/db/client.ts";

export function exportInvoices(accountId: string) {
  return selectInvoiceRows(db, accountId);
}
