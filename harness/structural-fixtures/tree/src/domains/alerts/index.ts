// FIRES domain-cycles: the first hop of the transitive cycle
// alerts -> quota -> thresholds -> alerts.
//
// This is the case that decides whether the check works. An implementation that
// asks "does A import B and does B import A" — the natural way to write it, and
// the way the direct billing/usage pair rewards — reports NOTHING here. No pair
// in this ring is mutual: alerts imports quota, quota imports thresholds, and
// only thresholds closes it. The cycle exists at depth three and at no shorter
// depth, so it is visible only to a pass over the whole component.
//
// A three-domain ring is also what a real one looks like. The direct pair gets
// noticed in review; this is the one that survives to become load-bearing.
import { allowanceFor } from "@/domains/quota/index.ts";

export function shouldAlert(used: number, plan: string): boolean {
  return used > allowanceFor(plan);
}
