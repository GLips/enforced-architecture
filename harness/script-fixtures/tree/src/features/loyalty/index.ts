// LEGAL: two modules below this barrel import each other. Silent.
//
// service/points.ts and service/tiers.ts form a cycle, so a trace with no
// visited set walks points → tiers → points → … until the depth cap, and then
// reports the cap against this barrel — a finding on a barrel that imports
// nothing server-only at all. The cap bounds COST; the visited set is what makes
// the recursion terminate, and this is the fixture that tells them apart.
export { awardPoints } from "./service/points.ts";
