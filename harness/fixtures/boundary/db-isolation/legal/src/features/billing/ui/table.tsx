// A different infrastructure module whose name merely starts the same way,
// and the feature's own repo layer, which is how UI is meant to get data.
import { dbtLogger } from "@/infrastructure/dbt-logger";
import { listInvoices } from "@/features/billing/repo/queries";

export const Table = () => [dbtLogger, listInvoices];
