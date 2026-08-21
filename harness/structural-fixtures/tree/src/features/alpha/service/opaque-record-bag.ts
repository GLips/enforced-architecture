// OBVIOUS for `types/no-opaque-record`: the headline spelling, written as the
// alias a payload gets passed around under. Every read off it needs a cast and
// no key is checked.
export type SettlementAttributes = Record<string, unknown>;
