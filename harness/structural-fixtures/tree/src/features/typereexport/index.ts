// LEGAL for barrel-purity: a re-export where EVERY name on the statement is a
// type, so the statement is erased and the module below it is never fetched.
//
// The mixed re-export in `tailtype` is the other half of this pair, and the two
// only pass together: an occurrence's mark is "erased only if every name on the
// statement is". Take it from any one entry and this barrel reports the
// `postgres` below through an import the compiler deletes; drop the mark
// entirely and the same happens. `tailtype` catches only the first mistake.
export type { LedgerShape } from "./service/ledger-shape.ts";
