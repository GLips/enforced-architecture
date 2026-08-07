// LEGAL for feature-deps, and hub's third target. Deliberately shallow: hub
// once reached its third feature through the ring, and `api/barrel-purity`
// correctly reported that hub's barrel could no longer be traced to its leaves
// within the depth limit. A fixture that provokes another check's real finding
// is a fixture in the wrong place.
export function readLeafTwo(id: string): string {
  const trimmed = id.trim();
  return `leaf-two:${trimmed}`;
}
