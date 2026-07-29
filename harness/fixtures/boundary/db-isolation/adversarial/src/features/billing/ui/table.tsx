// EXPECT: the schema rather than the client, and single-quoted
import { invoices } from '@/infrastructure/db/schema/invoices';

// EXPECT+2: a dynamic import, invisible to JsModuleSource
export const lazyRows = async () =>
  (await import("@/infrastructure/db")).db;

// EXPECT: a re-export carries the same dependency an import does
export { invoiceTable } from "@/infrastructure/db/schema";

export const Table = () => invoices;
