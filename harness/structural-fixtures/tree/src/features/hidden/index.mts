// LEGAL: an ordinary public surface, in a feature made ENTIRELY of `.mts`.
//
// The extension is the whole fixture. `CheckContext.occupiedDirs` globs
// `**/*.{ts,tsx}` and the import graph collects `**/*.{ts,tsx,mts,cts}`, so this
// directory is a feature to the graph and is invisible to the enumeration every
// grant file is read through. A rule that decides deny-by-default by looking up
// the importee in that enumeration flips to ALLOW-by-default for exactly the
// features nobody enumerated — silently, and only for the importees no fixture
// happened to name.
export const hiddenValue = "hidden";
