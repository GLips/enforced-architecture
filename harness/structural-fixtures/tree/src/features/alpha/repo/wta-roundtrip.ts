// OBVIOUS for `types/no-widen-then-assert`: a known value assigned to `unknown`
// and asserted straight back. Nothing was checked in between, so a field renamed
// on `SettlementUser` reports nowhere.
export type SettlementUser = { id: string; name: string };

export function storeSettlementUser(loaded: SettlementUser): SettlementUser {
  const widened: unknown = loaded;
  return widened as SettlementUser;
}
