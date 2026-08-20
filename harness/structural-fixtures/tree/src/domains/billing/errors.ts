// The back-edge's target. Imports nothing, so billing <-> usage is carried by
// the two DOMAINS and not by a pair of mutually importing files — a file-level
// cycle would let a much cruder check find this one and prove nothing about the
// domain graph.
export class BillingError extends Error {}
