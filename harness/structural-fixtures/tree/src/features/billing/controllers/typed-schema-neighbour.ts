// FIRES layer-occupancy: the SCHEMA arm written `import type`, which is the
// combination the other fixtures leave uncovered. `typed-repo-neighbour.ts`
// pins the type-only wording for a same-feature skip, where both ends are
// layers and the note names them; here the far end is the DB schema and is not
// a layer at all.
//
// So this is the case that fixes where the note's noun comes from. The verdict
// is identical to the runtime schema import next door — same path, same
// severity, same first five lines — so the wording is the whole of what this
// fixture can see, and the only place the arm's choice of noun is stated.
import type { invoicesTable } from "@/infrastructure/db/schema/invoices.ts";

export type InvoiceColumns = typeof invoicesTable;
