// The repo layer billing's controllers are supposed to go through, and the
// module the two adversarial fixtures reach around it to import. Its presence
// on disk is what activates the repo bypass check for this feature.
import { invoicesTable } from "@/infrastructure/db/schema/invoices.ts";
import { db } from "@/infrastructure/db/client.ts";

export function selectInvoiceRows(connection: typeof db, accountId: string) {
  return { table: invoicesTable.name, connection, accountId };
}
