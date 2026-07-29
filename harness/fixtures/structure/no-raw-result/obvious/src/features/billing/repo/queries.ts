import { eq } from "drizzle-orm";
import { db } from "@/infrastructure/db";
import { invoices } from "@/infrastructure/db/schema/invoices";

export function deleteInvoice(id: string) {
  // EXPECT+1: a delete returned straight to the caller, with no .returning()
  return db.delete(invoices).where(eq(invoices.id, id));
}
