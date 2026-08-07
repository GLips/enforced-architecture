// LEGAL: the identical schema import that fires from billing, in a feature that
// has neither `repo/` nor `service/`. Directory presence is what activates the
// check, so a feature holding no access infrastructure reaches the DB directly
// and is not this rule's business — nothing has been bypassed while there is
// nothing to bypass.
//
// This file is the presence test's only witness. Drop the test and it starts
// reporting, which is the failure that turns the rule from "keep your layers
// honest" into "every young feature needs three directories first".
import { invoicesTable } from "@/infrastructure/db/schema/invoices.ts";

export function listReports(accountId: string) {
  return { from: invoicesTable.name, where: accountId };
}
