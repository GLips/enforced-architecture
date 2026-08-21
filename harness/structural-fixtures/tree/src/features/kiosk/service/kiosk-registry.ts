// Support for the kiosk barrel: the names its wildcard hides. Two of them,
// because "the barrel advertises no names" only bites when there is more than
// one name to advertise.
export const kioskRegistryVersion = 3;

export function listKioskEntries(names: readonly string[]): string[] {
  const entries = names.map((name) => `kiosk:${name}`);
  return entries;
}
