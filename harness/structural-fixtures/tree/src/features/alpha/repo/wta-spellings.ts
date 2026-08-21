// ADVERSARIAL for `types/no-widen-then-assert`: the other spellings of the same
// round trip. The third broad target — an open dictionary with an opaque value —
// lives in `bag-widening.ts`, because that spelling is `types/no-opaque-record`'s
// subject too and a fixture two checks report on should say so in its name.
import type { SettlementUser } from "./wta-roundtrip.ts";

// The assertion spelling of the widening: `const x = v as unknown`, not
// `const x: unknown = v`.
export function assertedWidening(loaded: SettlementUser): SettlementUser {
  const widened = loaded as unknown;
  return widened as SettlementUser;
}

// `object` erases the fields without erasing the value.
export function objectWidening(loaded: SettlementUser): SettlementUser {
  const bagged: object = loaded;
  return bagged as SettlementUser;
}

function loadSettlementUser(): SettlementUser {
  return { id: "u-1", name: "ada" };
}

// A CALL is evidence now. The predecessor treated every call as a boundary and
// said so in its header; the checker reads the return type and sees that this
// one was known before it was thrown away.
export function callWidening(): SettlementUser {
  const widened: unknown = loadSettlementUser();
  return widened as SettlementUser;
}
