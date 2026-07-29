// The client barrel, and a path whose name merely ends the same way.
import { billingLabel } from "@/features/billing";
import { SERVER_TIMEOUT_MS } from "@/features/billing/index.server-config";

export const Panel = () => billingLabel + SERVER_TIMEOUT_MS;
