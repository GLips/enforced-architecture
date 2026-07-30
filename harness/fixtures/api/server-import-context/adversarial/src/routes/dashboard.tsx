// EXPECT+1: route files are isomorphic and cannot reach the server barrel
import { chargeCard } from "@/features/billing/index.server";
export const Route = () => chargeCard;
