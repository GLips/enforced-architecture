// OBVIOUS for `types/no-unknown-returns`: a declared return type that hands
// `unknown` to every caller, each of whom will invent their own narrowing.
export function readSettlementTotal(source: string): unknown {
  return source;
}
