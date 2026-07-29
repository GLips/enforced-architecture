import { pgTable, relations, text } from "drizzle-orm/pg-core";

// EXPECT: the call is nested in an export and spread across lines
export const lineItems = pgTable(
  "line_items",
  { id: text("id") },
);

// EXPECT: relations, the second declaration form a pgTable-only pattern misses
export const lineItemRelations = relations(lineItems, ({ one }) => ({}));

// EXPECT+1: a SECOND table in the same file, which needs per-match scoping
export const taxRows = pgTable("tax_rows", { id: text("id") });
