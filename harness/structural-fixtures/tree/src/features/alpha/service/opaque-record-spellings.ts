// ADVERSARIAL for `types/no-opaque-record`: the same open bag in the six other
// ways TypeScript lets you write one, plus the alias chain that must report at
// the DECLARATION and nowhere else.
//
// `SettlementPartial` is the case the syntactic predecessor documented as
// covered by nothing: the bag is one wrapper deep, so a walk that matches the
// literal name `Record` at the outermost position never sees it.

// An inline index signature.
export type SettlementIndex = { [key: string]: unknown };

// A mapped type over an open key domain.
export type SettlementMapped = { [K in string]: unknown };

// A bag one builtin deep. `Partial<…>` keeps the index signature.
export type SettlementPartial = Partial<Record<string, unknown>>;

// The same index signature given a name, which no type-position walk reaches.
export interface SettlementBag {
  [key: string]: unknown;
}

// `any` beside `unknown`, because banning one alone teaches the other.
export type SettlementAnyBag = Record<string, any>;

// The `object` keyword: every non-primitive, no property readable without a cast.
export type SettlementObjectBag = Record<string, object>;

// SILENT, and the count above is what pins it: an alias to a bag this tree
// already reports is not a second defect. One edit to `SettlementIndex` clears
// both, so a finding here would be an edit nobody can perform.
export type SettlementAliasedBag = SettlementIndex;
