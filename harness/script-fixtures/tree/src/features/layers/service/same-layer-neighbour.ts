// LEGAL: an import between two files of the SAME layer. Silent — a layer is
// where a module's peers live, and sideways edges are how it is composed.
//
// Sitting exactly on the line is what makes this fixture work: an
// implementation comparing ranks with `>=` instead of `>` reports it, and no
// upward fixture can reveal that, because they are all strictly above.
export { listRows } from "./queries.ts";
