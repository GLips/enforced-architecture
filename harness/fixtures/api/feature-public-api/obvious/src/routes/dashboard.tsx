// EXPECT+1: a route reaching past the feature barrel into its repo layer
import { listInvoices } from "@/features/billing/repo/queries";

// EXPECT+1: route files are isomorphic, so their server barrel is not legal
import { deleteInvoice } from "@/features/billing/index.server";

export const Route = () => [listInvoices, deleteInvoice];
