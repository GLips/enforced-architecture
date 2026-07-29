// The domain's public API, which is exactly what callers are meant to use.
import { calculateTax } from "@/domains/pricing";
import { priceTable } from "@/domains/pricing/index.server";

// A one-segment path is the barrel, not a deep import.
export { chargeFor } from "@/domains/billing";

// A different top-level directory whose name merely starts the same way.
import { legacyRate } from "@/domains-legacy/pricing/rate";

export const quote = (c: number) => calculateTax(c) + priceTable.base + legacyRate;
