// LEGAL neighbours for `types/no-broad-parameters`.

// `catch` binds `unknown`, so the value forwarded into an Error's `cause` has no
// type to name. Exempt by NAME, so the hole stays greppable.
export function wrapSettlementError(message: string, cause: unknown): Error {
  return new Error(message, { cause });
}

// A guard exists to give a type to input that has none, so demanding one is
// asking for the answer as the question.
export function isSettlementCode(value: unknown): value is string {
  return typeof value === "string";
}

// An OVERLOADED guard declares its predicate on the signature and widens the
// implementation's return type to `boolean`. Reading only this node's own return
// annotation reports the implementation's parameter; reading every declaration
// of the symbol — which is what the checker is for — does not.
export function isSettlementName(value: unknown): value is string;
export function isSettlementName(value: unknown): boolean {
  return typeof value === "string";
}

// A named input is the whole point of the check.
export function useSettlementCode(code: string): string {
  return code;
}

// A NAMED receiver is not a broad parameter. The `this` annotation is a real
// annotation the check walks, and a precise one draws nothing.
export type SettlementLedger = { total: number };

export function isSettledReceiver(this: SettlementLedger): boolean {
  return this.total > 0;
}

// A BROAD receiver with no predicate at all, which is the row that pins the
// exemption: `this` is not an input a caller passes, so every sentence this
// check has is addressed to nobody. Delete the receiver filter and this reports,
// with advice no edit can satisfy.
export function countSettlementFields(this: unknown): number {
  return Object.keys(this as object).length;
}

// A predicate over `this` vouches for the RECEIVER, and a receiver is not a
// parameter — so it exempts nothing here, and there is nothing left to exempt.
// What it DOES do is tell `types/no-runtime-typeof` that this function publishes
// a narrowing contract, which is the whole reason the two checks read the
// predicate through one function in `type-shapes.ts`.
export function hasSettlementTotal(this: unknown): this is { total: number } {
  return this !== null;
}

// A SELF-REFERENTIAL alias, which the compiler accepts and the unwrap must not
// chase forever: `Promise` and `Array` alternate with no end and no `unknown` at
// the bottom. Legal, and the reason `typeResolvesToFlags` carries a seen-set
// rather than a depth budget — swap it back for a bound and this stays green,
// swap it for nothing and the run hangs.
export type NestedSettlementBatch = Promise<NestedSettlementBatch[]>;

export function queueSettlementBatch(batch: NestedSettlementBatch): void {
  void batch;
}
