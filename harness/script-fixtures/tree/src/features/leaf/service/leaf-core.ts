// LEGAL for feature-deps: imported by one feature, importing none. An edge on
// its own is not a finding — without a case like this the check could report
// every feature it sees and still pass its positive fixtures.
export function readLeaf(id: string): string {
  const trimmed = id.trim();
  return `leaf:${trimmed}`;
}
