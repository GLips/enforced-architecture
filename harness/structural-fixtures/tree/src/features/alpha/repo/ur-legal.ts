// LEGAL neighbours for `types/no-unknown-returns`.
export type SettlementReceipt = { id: string };

// NO annotation keeps TypeScript's inference, which is precise. The check reads
// declared return types and nothing else.
export function inferredSettlementReceipt(id: string) {
  return { id };
}

// A named return type is the contract the check asks for.
export async function loadSettlementReceipt(id: string): Promise<SettlementReceipt> {
  return { id };
}

// A type parameter is not `unknown`, even where a caller instantiates it broadly.
export function passSettlementThrough<T>(value: T): T {
  return value;
}

// A predicate return is a contract too, and a narrow one.
export function isSettlementReceipt(value: unknown): value is SettlementReceipt {
  return value !== null;
}
