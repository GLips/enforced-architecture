// LEGAL neighbours for `types/no-opaque-record`. Each one looks like the
// violation and is not: a closed key domain names a shape, and a typed value
// under an open one is an ordinary lookup table.

export type SettlementStatus = "draft" | "paid";

export type SettlementInvoice = { id: string; total: number };

// Closed keys: a misspelling here is already a compile error.
export type SettlementTotalsByStatus = Record<SettlementStatus, unknown>;

// Open keys, typed value. This is the lookup table the check's own message asks for.
export type SettlementInvoicesById = Record<string, SettlementInvoice>;

// `keyof` closes the domain, so this is a dirty-field tracker rather than a bag.
export type SettlementDirtyFields = { [K in keyof SettlementInvoice]: unknown };

// An intersection is closed once any member is.
export type SettlementNamedKeys = Record<keyof SettlementInvoice & string, unknown>;

// A Map is the recovery the message prescribes for open-ended runtime keys, and
// it has no index signature at all.
export type SettlementRuntimeBag = Map<string, unknown>;
