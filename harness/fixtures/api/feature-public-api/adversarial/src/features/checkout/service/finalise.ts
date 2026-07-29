// Cross-feature deep imports: branch 2, which a route-only fixture never reaches.

// EXPECT: one feature reaching into another feature's service layer
import { chargeCard } from "@/features/billing/service/charge";

// EXPECT: single quotes, where a regex anchored on \" alone would miss
import { invoiceTotal } from '@/features/billing/repo/totals';

// EXPECT+2: a dynamic cross-feature deep import, invisible to JsModuleSource
export const lazyRefund = async () =>
  (await import("@/features/billing/service/refund")).refund;

// EXPECT: a re-export carries the same dependency an import does
export { InvoiceRow } from "@/features/billing/ui/row";

export const finalise = () => chargeCard(invoiceTotal());
