import { tierFor } from "./tiers.ts";

export function awardPoints(spend: number): number {
  const multiplier = tierFor(spend);
  return spend * multiplier;
}

export const basePoints = 1;
