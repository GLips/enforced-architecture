// Routes get their data through the client-safe feature barrel.
import { billingLabel } from "@/features/billing";

// The client env module, and an infrastructure module whose name merely
// starts the same way as the DB one.
import { env } from "@/env.client";
import { dbtLogger } from "@/infrastructure/dbt-logger";

export const Route = () => [billingLabel, env, dbtLogger];
