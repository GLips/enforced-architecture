// FIRES layer-occupancy: the service bypass written one directory deeper than
// the pattern that was meant to catch it.
//
// A check grepping specifiers for `../repo/` reads this as clean. The extra
// `../` is not a trick — it is what the same import looks like from a
// controller that grew a subdirectory, so the bypass rewrites itself the moment
// somebody tidies a folder. Only resolving against this file's own location
// says where `../../repo/invoice-rows.ts` lands.
//
// If the check regresses to matching the specifier, this file goes silent while
// `../invoices.ts` beside it keeps reporting, which reads as coverage.
import { selectInvoiceRows } from "../../repo/invoice-rows.ts";
import { db } from "@/infrastructure/db/client.ts";

export function runInvoiceJob(accountId: string) {
  return selectInvoiceRows(db, accountId);
}
