// FIRES layer-occupancy: the SCHEMA arm written `import type`, which is the
// combination the other fixtures leave uncovered. `typed-repo-neighbour.ts`
// pins the type-only wording for a same-feature skip, where the importee sits
// in a layer that can be named; here the importee is `infrastructure/db/schema`
// and sits in no layer at all.
//
// So this is the case that decides where the note's noun comes from. Derived
// from the importee's classification it has to be recovered from nothing, and
// the whole finding turns on the message saying "schema" — the verdict is
// identical to the runtime schema import next door, and the wording is the only
// part of it a fixture keyed on path and severity can see.
import type { invoicesTable } from "@/infrastructure/db/schema/invoices.ts";

export type InvoiceColumns = typeof invoicesTable;
