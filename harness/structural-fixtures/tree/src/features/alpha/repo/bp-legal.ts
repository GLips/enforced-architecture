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
