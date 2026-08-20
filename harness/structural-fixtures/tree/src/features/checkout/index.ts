// FIRES barrel-purity: the violation the doc names — a client-safe barrel three
// hops above `stripe`.
//
// index.ts → controllers/payments.ts → service/session.ts → "stripe". Nothing in
// that chain looks wrong on its own, which is the whole reason this is a script:
// a depth-1 implementation reads this barrel, sees one local re-export, and
// reports clean.
//
// The re-export is MIXED on purpose. Both Bun scans erase `type CheckoutSession`,
// and a check that treats the whole statement as erased stops here — but
// `chargeCard` is a runtime dependency and the chain below it is real.
export { type CheckoutSession, chargeCard } from "./controllers/payments.ts";
