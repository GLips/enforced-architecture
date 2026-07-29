import { eq } from "drizzle-orm";
import { db } from "@/infrastructure/db";
import { invoices } from "@/infrastructure/db/schema/invoices";

// .returning() converts the driver Result into plain rows, which serialize.
export function deleteInvoice(id: string) {
  return db.delete(invoices).where(eq(invoices.id, id)).returning();
}

export function upsertInvoice(id: string) {
  return db.insert(invoices).values({ id }).onConflictDoNothing().returning();
}

// Awaiting without returning gives the caller Promise<void>, which is safe.
export async function purge(id: string) {
  await db.delete(invoices).where(eq(invoices.id, id));
}

// A read has no driver Result to leak.
export function listInvoices() {
  return db.select().from(invoices);
}
