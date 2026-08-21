// The module behind the type-only re-export, and it is as server-only as this
// tree gets: `postgres` is imported for its value, on the first line. Reaching
// this file at all is the finding.
import postgres from "postgres";

export type LedgerShape = { total: number };

export const ledgerClient = postgres("postgres://localhost/ledger");
