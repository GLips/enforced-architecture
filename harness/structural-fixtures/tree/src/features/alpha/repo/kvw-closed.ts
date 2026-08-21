// LEGAL neighbours for `types/no-known-value-widening`.
import type { SettlementHandler } from "./kvw-widened.ts";

export type SettlementPhase = "draft" | "paid";

const draftSettlement: SettlementHandler = () => {};
const paidSettlement: SettlementHandler = () => {};

// Closed keys name exactly the keys the literal has, so nothing is deleted.
export const settlementByPhase: Record<SettlementPhase, SettlementHandler> = {
  draft: draftSettlement,
  paid: paidSettlement,
};

// An EMPTY literal is an accumulator getting the type it will grow into — the
// one case where the annotation adds information rather than subtracting it.
export const settlementAccumulator: Record<string, number> = {};

// A call is a boundary, not a value that carries its own evidence: the return
// type is not written here, so the annotation can only add.
export const settlementFromWire: unknown = JSON.parse("{}");

// A precise annotation over a precise literal deletes nothing.
export type SettlementRow = { id: string; total: number };
export const settlementRow: SettlementRow = { id: "s-1", total: 2 };
