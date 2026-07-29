// A .server.ts file is server-only whatever directory it sits in.
import { chargeCard } from "@/features/billing/index.server";
export const load = () => chargeCard();
