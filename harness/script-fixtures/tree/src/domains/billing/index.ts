// FIRES domain-cycles: half of the direct two-domain cycle, billing <-> usage.
//
// The obvious shape — billing reaches into usage here, and usage reaches back
// from its own barrel. Neither file is wrong on its own, which is the whole
// difficulty: the violation exists only in the pair, so nothing a per-file rule
// can see is out of place in either one.
//
// Written as an alias, which is the only legal spelling of a crossing once
// `boundary/cross-boundary-alias` is on. This check must still be the one that
// finds it: the alias is what a conforming project's code looks like, so a cycle
// check that only worked on relative spellings would report clean forever.
import { UsageError } from "@/domains/usage/errors.ts";

export function chargeForUsage(units: number): number {
  if (units < 0) throw new UsageError();
  return units * 2;
}
