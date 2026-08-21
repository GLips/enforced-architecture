// OBVIOUS for `types/no-broad-parameters`: an input that says nothing about
// itself, so every read inside the body has to check first.
export function handleSettlementPayload(payload: unknown): string {
  return String(payload);
}
