// A feature reaching into its OWN internals at any depth. The rule compares the
// two feature names and stays silent when they match — a shared prefix is not
// enough, so this file also proves the comparison is on the name, not the path.
import { invoiceTotal } from "@/features/billing/repo/totals";
import { chargeCard } from "@/features/billing/service/charge";

export const InvoiceRow = () => chargeCard(invoiceTotal());
