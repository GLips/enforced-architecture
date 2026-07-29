// EXPECT+1: a client-context component importing the server barrel
import { chargeCard } from "@/features/billing/index.server";

export const Panel = () => chargeCard;
