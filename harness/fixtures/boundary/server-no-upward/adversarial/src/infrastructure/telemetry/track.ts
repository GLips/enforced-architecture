// EXPECT: the domain layer, single-quoted
import { riskBand } from '@/domains/risk';

// EXPECT+2: a dynamic import, invisible to JsModuleSource
export const lazyRoute = async () =>
  (await import("@/routes/dashboard")).Route;

// EXPECT: a re-export carries the same dependency an import does
export { InvoiceRow } from "@/features/billing/ui/row";

// EXPECT: the bare layer barrel with no path segment after it
import features from "@/features";

export const track = () => [riskBand, features];
