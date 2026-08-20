// FIRES layer-occupancy: the repo bypass in its plainest form. A controller
// importing the DB schema to build its own query while `features/billing/repo/`
// sits right there holding the function it should have called.
//
// The layer is not missing — it is present and empty of this query, which is
// the state the check exists to catch. Nothing in this file looks wrong on its
// own; what is wrong is only visible next to a directory listing.
import { invoicesTable } from "@/infrastructure/db/schema/invoices.ts";

export function listInvoices(accountId: string) {
  return { from: invoicesTable.name, where: accountId };
}
