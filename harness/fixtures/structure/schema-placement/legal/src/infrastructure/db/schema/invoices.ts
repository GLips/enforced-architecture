import { pgTable, relations, text } from "drizzle-orm/pg-core";

// The one directory schema belongs in.
export const invoices = pgTable("invoices", { id: text("id") });
export const invoiceRelations = relations(invoices, ({ one }) => ({}));
