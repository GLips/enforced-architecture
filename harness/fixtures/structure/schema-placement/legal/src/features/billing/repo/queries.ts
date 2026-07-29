// Importing the schema is what every repo does; only DECLARING it is restricted.
import { invoices } from "@/infrastructure/db/schema/invoices";
import { db } from "@/infrastructure/db";

// Identifiers that merely contain the name.
const pgTableName = "invoices";
const buildRelationsMap = () => ({});

export const list = () => [db.select().from(invoices), pgTableName, buildRelationsMap];
