// FIRES domain-cycles: the closing hop, thresholds -> alerts.
//
// The edge that makes the ring, and the only one of the three where the cycle is
// even in principle findable from a single file — and only then if you already
// know the two hops that came before. Nothing in this file names quota.
import { AlertError } from "@/domains/alerts/errors.ts";

export function levelFor(plan: string): number {
  if (plan === "") throw new AlertError();
  return plan.length;
}
