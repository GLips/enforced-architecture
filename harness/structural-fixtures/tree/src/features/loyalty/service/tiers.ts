// The other half of the cycle: it imports the module that imports it.
import { basePoints } from "./points.ts";

export function tierFor(spend: number): number {
  if (spend > 100) return basePoints * 2;
  return basePoints;
}
