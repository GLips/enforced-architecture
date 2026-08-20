// LEGAL: an ordinary public surface, in a feature made ENTIRELY of `.mts`.
//
// The extension is the whole fixture, and this is the DENY half of a pair.
// `occupiedDirs` globs `**/*.{ts,tsx}` and the import graph collects
// `**/*.{ts,tsx,mts,cts}`, so a rule that enumerates features through the
// occupancy walker cannot see this directory while the graph routes edges into
// it. `hidden` grants nobody, so the edge into it must be denied; `remote` next
// door is the same shape WITH a grant, and proves the deny can be cleared.
// Neither alone is enough — a check can deny correctly and still make the
// denial impossible to clear.
export const hiddenValue = "hidden";
