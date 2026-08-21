// The schema bypass, against a schema that is ONE MODULE rather than a
// directory. `billing` has an occupied `repo/`, so a controller constructing a
// query against the tables reaches past it.
//
// Silent under this tree's own vocabulary, where the schema is `db/schema/` and
// this import names an ordinary infrastructure module. See the probe in
// `run-structural-fixtures.ts` for the vocabulary that makes it the subject.
import { invoiceTable } from "@/infrastructure/db/tables";

export const listInvoices = (): unknown => invoiceTable;
