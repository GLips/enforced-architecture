// OBVIOUS for `types/no-known-value-widening`: the canonical case. The literal
// knows its own keys; the annotation replaces them with "any string", so
// `handlers.stpo` compiles and the editor lists nothing.
export type SettlementHandler = () => void;

const startSettlement: SettlementHandler = () => {};
const stopSettlement: SettlementHandler = () => {};

export const settlementHandlers: Record<string, SettlementHandler> = {
  start: startSettlement,
  stop: stopSettlement,
};
