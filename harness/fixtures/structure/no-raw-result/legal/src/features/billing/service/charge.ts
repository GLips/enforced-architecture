// service/ is outside this rule's layer scope: repo/ and controllers/ are the
// two layers that run Drizzle writes, so a stray call here is a different
// rule's finding (boundary/db-isolation), not this one's.
import { db } from "@/infrastructure/db";
import { invoices } from "@/infrastructure/db/schema/invoices";

export function deleteInvoice(id: string) {
  return db.delete(invoices);
}
