// ADVERSARIAL for `types/no-broad-parameters`: the other spellings, the other
// signature positions, and the guard that vouches for one input and not the
// second.

// `any` sits beside `unknown`, because banning one alone teaches the other.
export function acceptsAnySettlement(payload: any): string {
  return String(payload);
}

// `object` is a different mistake and gets a different sentence.
export function acceptsObjectSettlement(payload: object): string {
  return String(payload);
}

// A method signature on an interface is a call signature the walk has to reach;
// a check that only visited function declarations is silent on every interface
// in the tree.
export interface SettlementSink {
  accept(item: unknown): void;
}

// An arrow is the third position.
export const acceptsViaArrow = (payload: unknown): string => String(payload);

// A container of `unknown` is still `unknown` at the call site.
export function acceptsPendingSettlement(payload: Promise<unknown>): Promise<string> {
  return payload.then(String);
}

// A guard vouches for ONE parameter. The second is not covered by the predicate
// and still reports, which is what stops `value is T` from being a blanket hatch.
export function isSettlementIdWithExtra(value: unknown, extra: unknown): value is string {
  return typeof value === "string" && extra !== undefined;
}
