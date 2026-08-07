// Support for the surface barrels: one value and one type for them to
// re-export. The barrels are the subject of this feature's fixtures, and a
// barrel needs something real on the other end of its specifier — a re-export
// of a name nothing defines is a shape no reviewer would ever read past.
export type RegistryEntry = { id: string };

export function readSurfaceRegistry(entries: readonly string[]): RegistryEntry[] {
  const registry = entries.map((id) => ({ id }));
  return registry;
}
