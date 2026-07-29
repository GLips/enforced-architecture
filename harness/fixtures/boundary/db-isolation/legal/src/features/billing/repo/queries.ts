// repo/ is the DB boundary the rule exists to establish.
import { db } from "@/infrastructure/db";
import { invoices } from "@/infrastructure/db/schema/invoices";
export const listInvoices = () => db.select().from(invoices);
