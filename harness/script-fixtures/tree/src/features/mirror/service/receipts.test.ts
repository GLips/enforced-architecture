// LEGAL: a correctly mirrored test whose source is `.tsx`. Silent.
//
// The sibling is `receipts.tsx`, not `receipts.ts`. An implementation that looks
// only for `<base>.ts` reports this test as an orphan — and in a real repo that
// misfire lands on every component test at once, which is how a warning-level
// check gets read as noise and switched off.
export const receiptColumnCases = ["date", "amount"];
