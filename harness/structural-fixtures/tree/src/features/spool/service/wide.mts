// ADVERSARIAL: a feature whose only source file is `.mts`, fanning out past the
// threshold.
//
// Fan-out is reported by walking the NODE SET, which is the occupancy walk
// rather than the graph — so a feature the walk cannot see has no fan-out
// however wide it is. Every importee grants `spool` deliberately:
// `api/feature-visibility` must stay silent here, or this fixture would prove
// that check instead of this one.
import { readLeaf } from "@/features/leaf";
import { readLeafTwo } from "@/features/leaf-two";
import { routeLabel } from "@/features/dispatch";

export const spoolWidth = (): number => readLeaf() + readLeafTwo() + routeLabel().length;
