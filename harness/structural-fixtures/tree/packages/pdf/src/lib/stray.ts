// The undeclared-sibling fixture, and half of the two-tree probe.
//
// `lib/` is not a top-level directory in any vocabulary, so `placement/topology`
// reports this file the moment `packages/pdf/src` is a declared tree — and says
// nothing at all while it is not. Silence here is what "a tree you did not
// declare is a tree you did not adopt for" costs, stated as a file rather than
// as prose.
export const strayPdfHelper = (): string => "stray";
