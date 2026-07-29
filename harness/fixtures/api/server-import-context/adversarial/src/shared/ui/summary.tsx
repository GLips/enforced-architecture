// EXPECT: a relative path to a server barrel, where the pattern assumed an alias
import { auditLog } from "../../features/billing/index.server";

// EXPECT: single quotes, where a regex anchored on \" alone would miss
import { taxTable } from '@/domains/pricing/index.server';

// EXPECT+2: a dynamic import, invisible to JsModuleSource
export const lazyCharge = async () =>
  (await import("@/features/billing/index.server")).chargeCard;

// EXPECT: a re-export carries the same dependency an import does
export { refund } from "@/features/checkout/index.server";

export const Summary = () => [auditLog, taxTable];
