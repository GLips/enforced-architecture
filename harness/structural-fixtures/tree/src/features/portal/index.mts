// FIRES barrel-discoverability: the same plain wildcard as `gateway/index.ts`,
// in a barrel spelled `.mts`.
//
// The extension is the whole case. This check knows its subject sits exactly one
// directory below a subdivided root, and naming the extension alongside the
// barrel module in that glob narrows it to one of the eight extensions the tier
// walks — this barrel goes unopened while the identical `.ts` one beside it
// reports.
export * from "./service/portal-routes.mts";
