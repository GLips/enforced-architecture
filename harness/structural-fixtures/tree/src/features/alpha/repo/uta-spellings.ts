// ADVERSARIAL for `types/no-unknown-type-aliases`: the chain, the weaker
// keyword, the container, and the alias the syntactic predecessor could not see
// because it only read top-level declarations.

// A CHAIN reports at every link. Each name is its own broken promise, and one
// edit to the first clears both.
type SettlementLevelOne = unknown;
export type SettlementLevelTwo = SettlementLevelOne;

// `any` is the weaker sibling.
export type SettlementLoose = any;

// A container of nothing is still nothing.
export type SettlementPending = Promise<unknown>;

// Declared INSIDE a function, which a top-level walk never reached.
export function settlementScope(): number {
  type SettlementInner = unknown;
  const held: SettlementInner[] = [];
  return held.length;
}

// A GENERIC alias that ignores its parameter promises nothing, exactly like a
// bare one. An early-out on `typeParameters` — the obvious way to keep
// `Boxed<T> = T` quiet — silences this too, and nothing else in the tree notices.
export type SettlementBoxedNothing<T> = unknown;
