// A domain reaching into another domain's internals is excluded deliberately:
// the domain layer owns its own file layout.
import { roundToCents } from "@/domains/pricing/internal/rounding";
import { riskBand } from "@/domains/risk/internal/band";

export const calculateTax = (cents: number) => roundToCents(cents * riskBand);
