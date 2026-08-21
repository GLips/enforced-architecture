// LEGAL for barrel-purity: the chain below reaches `stripe` for its TYPES only.
// An erased import puts nothing in a client bundle, so this barrel is clean —
// and it is the one direction the scanner cannot decide for this check, because
// the import graph wants the same edge kept.
export { shapeOfCharge } from "./service/charge-shape.ts";
