// FIRES barrel-purity: a mixed re-export whose TYPE name is written LAST.
//
// `checkout` has the same shape with the type name first, and the two only pass
// together: an occurrence's mark has to be "erased only if EVERY name on the
// statement is", not "whatever the last name said". Take the last one and this
// whole statement reads as erased, the trace stops here, and the `postgres`
// below is unreported.
export { settle, type SettleResult } from "./service/settle.ts";
