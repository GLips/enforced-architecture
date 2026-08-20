// FIRES domain-cycles: the other half of the direct cycle, usage -> billing.
//
// Lands on billing's errors module rather than its barrel, so the two edges of
// the cycle do not share a single file between them. What closes is the domain
// graph; no file here imports a file that imports it back.
import { BillingError } from "@/domains/billing/errors.ts";

export function reportSpend(units: number): number {
  if (units < 0) throw new BillingError();
  return units;
}
