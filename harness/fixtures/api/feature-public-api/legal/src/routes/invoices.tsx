// The two deep paths routes are deliberately allowed.
import { listInvoices } from "@/features/billing/index.server";
import { InvoiceRow } from "@/features/billing/ui/row";
import { InvoiceTable } from "@/features/billing/ui";

// The barrel is always legal, from anywhere.
import { billingLabel } from "@/features/billing";

export const Route = () => [listInvoices, InvoiceRow, InvoiceTable, billingLabel];
