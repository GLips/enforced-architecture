// Routes are a server context and may reach the server barrel.
import { chargeCard } from "@/features/billing/index.server";
export const Route = () => chargeCard;
