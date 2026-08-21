// ADVERSARIAL for `types/no-known-value-widening`: the same loss at every site
// an annotation can sit above a written value, plus the two broad keywords and
// the WRAPPED dictionary the syntactic predecessor recorded as covered by
// nothing.
import type { SettlementHandler } from "./kvw-widened.ts";

const oneSettlementHandler: SettlementHandler = () => {};

// A bag one builtin deep. `Partial<...>` keeps the index signature, so the keys
// are still deleted.
export const wrappedSettlementHandlers: Partial<Record<string, SettlementHandler>> = {
  start: oneSettlementHandler,
};

// The two broad keywords, over a literal that knows exactly what it is.
export const opaqueSettlement: unknown = { id: "s-1" };
export const nonPrimitiveSettlement: object = { id: "s-1" };

// A class property is the second site.
export class SettlementTotals {
  readonly byMonth: Record<string, number> = { january: 1 };
}

// A `return` is the third: the annotation belongs to the function, not the
// statement, and a check that looked at the statement alone finds nothing.
export function settlementTotalsByMonth(): Record<string, number> {
  return { january: 1 };
}

// A concise arrow body is a return with no `ReturnStatement` node to visit.
export const settlementTotalsInline = (): Record<string, number> => ({ january: 1 });
