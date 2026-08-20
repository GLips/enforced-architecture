// The target of `src/features/escaping-link`, and deliberately OUTSIDE the
// source root: a vendored package, or one a monorepo hoisted, linked into
// features/ so the resolver loads it as a feature.
//
// Nothing walks this directory — `Bun.Glob.scanSync` does not traverse symlinks,
// and `vendor/` is under no configured root. It is here to be RESOLVED: the
// canonicaliser realpaths the link, and a directory at the far end is what makes
// the name a feature rather than a dangling specifier.
export const escapedValue = "escaped";
