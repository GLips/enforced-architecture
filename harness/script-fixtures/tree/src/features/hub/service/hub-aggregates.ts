// FIRES feature-deps (obvious): fan-out. Three distinct features, every edge
// granted and acyclic — nothing here is a cycle and nothing here is ungranted.
// The finding is about the SHAPE: a feature reaching this wide is affected by
// changes almost anywhere.
import { chargeAccount } from "@/features/cycle-a/index.ts";
import { readLeaf } from "@/features/leaf/index.ts";
import { readLeafTwo } from "@/features/leaf-two/index.ts";

export function summarise(id: string): string {
  const parts = [chargeAccount(id), readLeaf(id), readLeafTwo(id)];
  return parts.join("|");
}
