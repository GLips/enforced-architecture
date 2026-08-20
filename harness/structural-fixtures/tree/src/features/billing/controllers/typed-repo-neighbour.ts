// LEGAL: a type-only import of the very repo module the adversarial fixtures
// are reported for. Same feature, same layer, same resolved target — the only
// difference is that this one compiles away and couples nothing at runtime.
//
// It is here because the graph reveals type imports on purpose, so this edge IS
// handed to the check and has to be dropped deliberately rather than never
// arriving. A check reading only the resolved target reports it.
import type { selectInvoiceRows } from "@/features/billing/repo/invoice-rows.ts";

export type InvoiceRows = ReturnType<typeof selectInvoiceRows>;
