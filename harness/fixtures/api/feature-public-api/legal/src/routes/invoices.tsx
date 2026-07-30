// Feature UI is the one deep path routes may use.
import { InvoiceRow } from "@/features/billing/ui/row";
import { InvoiceTable } from "@/features/billing/ui";

// The barrel is always legal, from anywhere.
import { billingLabel } from "@/features/billing";

export const Route = () => [InvoiceRow, InvoiceTable, billingLabel];
