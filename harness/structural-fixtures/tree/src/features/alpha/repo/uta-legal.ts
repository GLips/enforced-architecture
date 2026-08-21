// LEGAL neighbours for `types/no-unknown-type-aliases`.

// A GENERIC alias has no resolved body to judge: `T` is a type parameter, and
// what a caller instantiates it with is the caller's declaration, not this one.
export type SettlementBoxed<T> = T;

export type SettlementIdentifier = string;

export type SettlementState = "open" | "closed";

export type SettlementEnvelope = { id: SettlementIdentifier; state: SettlementState };
