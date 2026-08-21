// FIRES import-policy ONCE: a sibling-feature crossing written as a re-export
// that carries a type name and a value name together.
//
// The export record holds one entry per NAME, so this statement arrives as two
// entries at one offset. An occurrence is one written specifier — ungrouped this
// is two edges on one line and every rule reading the graph reports the line
// twice. The count is the whole assertion.
export { type BetaShape, betaThing } from "../../beta/service/beta-both.ts";
