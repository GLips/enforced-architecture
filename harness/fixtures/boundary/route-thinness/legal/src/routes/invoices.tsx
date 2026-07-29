// Routes get their data through feature barrels, which is the whole rule.
import { listInvoices } from "@/features/billing/index.server";
import { billingLabel } from "@/features/billing";

// The client env module, and an infrastructure module whose name merely
// starts the same way as the DB one.
import { env } from "@/env.client";
import { dbtLogger } from "@/infrastructure/dbt-logger";

export const Route = () => [listInvoices, billingLabel, env, dbtLogger];
