// LEGAL for barrel-purity: the traced module names `stripe` in a TYPE POSITION
// and nowhere else, so nothing of it reaches a bundle.
//
// `erased` and `invoices` next door spell the same claim with `import type`,
// which the module record marks for the scanner. This one is `type X =
// import("stripe").Y`, which reaches no module record at all — it is read off
// the AST, and the mark is set THERE. Stop setting it and this barrel reports a
// runtime dependency the compiler erases, with both of those fixtures still
// green.
export { chargeLabel } from "./service/charge-label.ts";
