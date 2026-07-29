// EXPECT+1: a shared utility reaching up into the app
import { billingLabel } from "@/features/billing";

export const formatDate = () => billingLabel;
