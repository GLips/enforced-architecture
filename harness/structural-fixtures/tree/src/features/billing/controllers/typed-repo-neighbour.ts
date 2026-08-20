// FIRES layer-occupancy: the same controllers -> repo bypass the adversarial
// fixtures are reported for, written `import type`. Same feature, same layers,
// same resolved target — the only difference is that this one compiles away.
//
// Which is the argument for skipping it, and it is beside the point. A type
// import couples nothing at RUNTIME; occupancy protects KNOWLEDGE. Naming
// `selectInvoiceRows`'s shape here makes the repo's contract part of what this
// controller is written against, and neither layer can be lifted out while that
// is true — so exempting it would weaken "never bypass an occupied layer" into
// "never execute through a bypass", and make `import type` the supported way to
// bind a controller straight to a repo contract with service/ sitting there.
//
// The verdict must not branch on `typeOnly`; only the message's wording may.
import type { selectInvoiceRows } from "@/features/billing/repo/invoice-rows.ts";

export type InvoiceRows = ReturnType<typeof selectInvoiceRows>;
