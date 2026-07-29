// EXPECT+1: a shared UI primitive taking on a feature dependency
import { invoiceTotal } from "@/features/billing";

export const InvoiceBadge = () => invoiceTotal();
