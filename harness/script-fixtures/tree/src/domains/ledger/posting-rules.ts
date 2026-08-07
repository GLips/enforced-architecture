// LEGAL for topology, and the case that decides whether its grammar is
// per-boundary. `directory-model.md` puts a domain's internal modules —
// parsers, transforms, calculation engines — directly at the domain root, and a
// check that applies the FEATURE grammar to `domains/` rejects every one of
// them. That is the rule's own named failure mode: a file the architecture
// recommends, rejected by the check meant to enforce it.
//
// It is safe here for a reason, not by exemption: every domain-scoped rule keys
// on `domains/<name>/` and reaches this file. Nothing escapes into it.
const OPENING_BALANCE = 0;

export function postingBalance(entries: number[]): number {
  let total = OPENING_BALANCE;
  for (const entry of entries) total += entry;
  return total;
}
