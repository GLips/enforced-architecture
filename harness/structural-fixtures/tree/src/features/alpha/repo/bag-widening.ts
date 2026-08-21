// ADVERSARIAL for TWO checks at once, and the name says so because the fixture
// tree's one rule is that a file firing someone else's check gets moved or
// renamed rather than smuggled into their expectations.
//
// `types/no-widen-then-assert` reads these as its third broad target: an open
// dictionary with an opaque value is a widening like `unknown` and `object` are,
// and `Partial<...>` keeps the index signature so the wrapped spelling is one
// too — a spelling the syntactic predecessor recorded as covered by nothing.
//
// `types/no-opaque-record` reads the same two annotations as bags, which they
// are. The two messages are jointly actionable and that is why both are allowed
// to speak here: one says stop widening, the other says name the fields, and
// deleting the local satisfies both. Neither prescribes an edit the other denies.
import type { SettlementUser } from "./wta-roundtrip.ts";

export function recordWidening(loaded: SettlementUser): SettlementUser {
  const bagged: Record<string, unknown> = loaded;
  return bagged as SettlementUser;
}

export function wrappedRecordWidening(loaded: SettlementUser): SettlementUser {
  const bagged: Partial<Record<string, unknown>> = loaded;
  return bagged as SettlementUser;
}
