// The hop below a mixed re-export. Server-only, and reachable only while the
// re-export above counts as a runtime import.
import postgres from "postgres";

export type SettleResult = { readonly settled: boolean };

export const settle = (): SettleResult => {
  void postgres;
  return { settled: true };
};
