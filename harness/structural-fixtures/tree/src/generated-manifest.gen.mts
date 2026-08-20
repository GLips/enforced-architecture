// LEGAL, and it pins the exemption predicate rather than this check.
//
// A generated file at the source root: `placement/topology` reports any root
// file the tree does not declare, so this is reported the moment it stops being
// architecture-exempt. It is written `.gen.mts` on purpose — an exemption regex
// that lists extensions (`/\.gen\.[tj]sx?$/`) covers four of the eight the
// walkers accept and misses this one, which is a finding against a file nobody
// wrote and nobody can edit.
export const generatedManifest = { routes: [] } as const;
