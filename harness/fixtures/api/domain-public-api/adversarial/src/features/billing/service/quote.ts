// EXPECT: single quotes, where a regex anchored on \" alone would miss
import { taxTable } from '@/domains/pricing/tables/vat';

// EXPECT: a re-export carries the same dependency an import does
export { roundToCents } from "@/domains/pricing/internal/rounding";

// EXPECT: a namespace re-export of a domain internal
export * from "@/domains/pricing/internal/currency";

// EXPECT+2: a dynamic import, invisible to JsModuleSource
export const lazyRate = async () =>
  (await import("@/domains/pricing/rates/live")).rate;

// EXPECT: a type-only deep import still couples callers to the internal layout
import type { TaxBand } from "@/domains/pricing/tables/bands";

export const bands: TaxBand[] = [];
export const table = taxTable;
