import { eq } from "drizzle-orm";
import { db } from "@/infrastructure/db";
import { invoices } from "@/infrastructure/db/schema/invoices";

export async function upsertInvoice(id: string) {
  // EXPECT+1: the insert path, which a delete-only pattern misses entirely
  return db.insert(invoices).values({ id }).onConflictDoNothing();
}

export async function purge(id: string) {
  // EXPECT: wrapped in an await and spread across lines
  return await db
    .delete(invoices)
    .where(eq(invoices.id, id));
}

export async function purgeAll() {
  // EXPECT+1: a SECOND violation in the same file, which needs per-match scoping
  return db.delete(invoices);
}
