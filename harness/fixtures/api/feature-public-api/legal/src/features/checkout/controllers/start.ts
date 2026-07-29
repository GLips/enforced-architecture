// Cross-feature via the server barrel, which branch 2 exempts by name.
import { chargeCard } from "@/features/billing/index.server";
// Cross-feature via the client barrel, which is not a deep import at all.
import { billingLabel } from "@/features/billing";

export const start = () => chargeCard(billingLabel);
