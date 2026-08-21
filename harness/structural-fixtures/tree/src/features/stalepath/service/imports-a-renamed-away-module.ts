// FIRES feature-visibility: the crossing is real and ungranted, and NO FILE ON
// DISK BACKS THE SPECIFIER — `mislaid` renamed the module away.
//
// This is the one fixture that holds the graph's `resolved: false` arm down.
// Every other edge in this tree resolves, so a resolver wired to DROP what it
// cannot follow passes the whole suite: the substrate would answer "not a
// boundary question" for an import that plainly crosses one, and every boundary
// rule would report clean over code nobody checked. Resolution sharpens an
// edge; it never deletes one.
import { retiredMetric } from "@/features/mislaid/service/renamed-away.ts";

export const readIt = () => retiredMetric;
