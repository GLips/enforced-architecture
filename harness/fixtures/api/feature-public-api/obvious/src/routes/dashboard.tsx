// EXPECT+1: a route reaching past the feature barrel into its repo layer
import { listInvoices } from "@/features/billing/repo/queries";

export const Route = () => listInvoices;
