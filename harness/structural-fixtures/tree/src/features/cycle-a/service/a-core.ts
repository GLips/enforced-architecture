// FIRES feature-deps (obvious): half of a direct two-feature cycle.
//
// Both halves are FULLY GRANTED in each other's visibility.json, which is the
// point of the pair rather than an oversight — `api/feature-visibility` reports
// nothing here and the cycle still hard-fails. The two checks are blind to each
// other, and a project that answers a cycle by declaring both directions has
// only written the cycle down.
import { settleAccount } from "@/features/cycle-b/index.ts";

export function chargeAccount(id: string): string {
  const settled = settleAccount(id);
  return `charge:${settled}`;
}
