// LEGAL for feature-deps, and hub's third target. Deliberately shallow: reached
// through the ring instead, this leaf sits past `api/barrel-purity`'s depth
// limit, and that check correctly reports that hub's barrel cannot be traced to
// its leaves. A fixture that provokes another check's real finding is a fixture
// in the wrong place.
export function readLeafTwo(id: string): string {
  const trimmed = id.trim();
  return `leaf-two:${trimmed}`;
}
