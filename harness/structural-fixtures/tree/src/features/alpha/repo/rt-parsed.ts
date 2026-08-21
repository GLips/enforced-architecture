// OBVIOUS for `types/no-runtime-typeof`: a branch deciding what an untyped
// value is from its representation, with no contract anywhere.
export function classifySettlementPayload(text: string): string {
  const parsed: unknown = JSON.parse(text);
  if (typeof parsed === "string") return parsed;
  return "other";
}
