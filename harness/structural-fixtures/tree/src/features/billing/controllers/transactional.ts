// LEGAL: the DB CLIENT imported from a controller while `repo/` exists. This is
// the neighbour that matters most, because the obvious way to write the repo
// bypass check — "controllers must not import infrastructure/db" — reports it.
//
// Wrapping several service calls in one transaction requires the controller to
// hold the connection and pass it down. The client conveys execution
// capability; the schema conveys query construction. Only construction has to
// be concentrated in repo/, so only the schema import is a finding.
//
// A check that stops distinguishing the two takes the transaction boundary with
// it, and the first thing a team does about that is switch the check off.
import { db } from "@/infrastructure/db/client.ts";
import { summariseInvoices } from "../service/invoice-summary.ts";

export function settleInvoices(accountId: string) {
  return db.transaction(() => summariseInvoices(accountId));
}
