import { pgTable, text } from "drizzle-orm/pg-core";

// EXPECT+1: a table declared outside the schema directory
export const invoices = pgTable("invoices", { id: text("id") });
