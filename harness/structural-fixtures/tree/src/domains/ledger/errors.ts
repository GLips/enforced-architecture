// The within-domain target for `index.ts`. Its whole job is to be reachable by a
// relative path that never leaves domains/ledger.
export class LedgerError extends Error {}
