// Branch 3: lower layers get no deep imports at all, not even the ui/ path
// that routes are allowed.

// EXPECT: shared reaching into a feature's UI, which routes may do and shared may not
import { InvoiceRow } from "@/features/billing/ui/row";

export const format = () => InvoiceRow;
