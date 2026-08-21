// FIRES barrel-purity: the violation the doc names — a client-safe barrel three
// hops above `stripe`.
//
// index.ts → controllers/payments.ts → service/session.ts → "stripe". Nothing in
// that chain looks wrong on its own, which is the whole reason this is a script:
// a depth-1 implementation reads this barrel, sees one local re-export, and
// reports clean.
//
// The re-export is MIXED on purpose. `type CheckoutSession` is erased and
// `chargeCard` is not, so a check reading `typeOnly` per STATEMENT rather than
// per specifier drops the whole line and the trace stops here — while the chain
// below `chargeCard` is real.
export { type CheckoutSession, chargeCard } from "./controllers/payments.ts";
