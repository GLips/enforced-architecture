// LEGAL: a domain importing OUT to shared/ and back into itself. Silent.
//
// Two ends that are not cross-domain edges, and both are shapes a check keying
// on "an import that leaves this file" would count:
//
//   - `@/shared/lib/shared-thing.ts` lands outside domains/ entirely. It has no
//     domain end, so it is not a node in this graph and cannot sit in a cycle.
//   - `./errors.ts` stays inside domains/ledger. Both ends are the same
//     boundary, so it is a within-domain move — the relative spelling is the
//     correct one here, and `boundary/import-policy` leaves it alone for
//     the same reason this check does.
//
// The second carries the weight: a check that treats every resolved import from
// a domain file as an outgoing edge gives ledger a self-loop and reports a
// one-domain cycle.
import { LedgerError } from "./errors.ts";
import { sharedThing } from "@/shared/lib/shared-thing.ts";

export function postEntry(amount: number): string {
  if (amount < 0) throw new LedgerError();
  return `${sharedThing}-${amount}`;
}
