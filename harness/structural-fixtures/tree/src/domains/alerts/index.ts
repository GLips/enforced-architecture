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
// The within-domain hop, in a domain that IS in a cycle. `ledger` holds the
// other half of this — a self-edge must not make a one-domain cycle — but there
// the SCC size filter answers it anyway, so nothing there is a witness. Here the
// component is real and the trail is what breaks: counted as an edge, this
// import puts "alerts -> alerts" in the list of imports the finding tells
// someone to go and cut, and the line names a file that is not part of the ring.
import { AlertError } from "./errors.ts";

export function shouldAlert(used: number, plan: string): boolean {
  if (plan === "") throw new AlertError();
  return used > allowanceFor(plan);
}
