// FIRES domain-cycles: the middle hop, quota -> thresholds.
//
// Nothing here points back at alerts. Read on its own this file is a domain
// depending on a lower one, which is exactly what a domain is allowed to do —
// the middle of a transitive cycle never looks like a violation, and that is why
// it is the hop a reviewer waves through.
import { levelFor } from "@/domains/thresholds/index.ts";

export function allowanceFor(plan: string): number {
  return levelFor(plan) * 100;
}
