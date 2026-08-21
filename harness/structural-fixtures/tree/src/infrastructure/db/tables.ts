// A SINGLE-MODULE schema — the ordinary Drizzle shape, and the one this tree
// does not otherwise have: `db/schema/` next door is a directory of table
// modules.
//
// Under this tree's vocabulary `dbSchemaSubdir` is `schema`, so nothing here is
// the schema and no check reports it. It exists for the probe in
// `run-structural-fixtures.ts`, which runs the same registry over the same tree
// with that one word changed. Read with its extension on, this module is equal
// to no schema position and under none, and `boundary/layer-occupancy`'s schema
// arm falls silent for every repo shaped this way.
export const invoiceTable = { name: "invoices" };
