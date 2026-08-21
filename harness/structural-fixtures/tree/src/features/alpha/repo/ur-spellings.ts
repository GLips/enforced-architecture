// ADVERSARIAL for `types/no-unknown-returns`: the containers that make `unknown`
// look like a contract, plus `any` and the interface position.
//
// Every body here returns a PARAMETER rather than a literal. The value is beside
// the point for this check — it reads declared return types and nothing else —
// and a literal would additionally be `types/no-known-value-widening`'s subject,
// which belongs in that check's own fixtures.

// A promise of nothing is still nothing once awaited.
export async function loadSettlementTotal(source: string): Promise<unknown> {
  return source;
}

// So is an array of it.
export function listSettlementTotals(source: string): unknown[] {
  const totals = [source];
  return totals;
}

// `any` is the weaker sibling and is banned on the same terms.
export function readSettlementTotalLoosely(source: string): any {
  return source;
}

// A method signature on an interface, which a walk over function declarations
// alone never reaches.
export interface SettlementReader {
  read(): unknown;
}

// An arrow with an explicit return annotation.
export const readSettlementInline = (source: string): unknown => source;
