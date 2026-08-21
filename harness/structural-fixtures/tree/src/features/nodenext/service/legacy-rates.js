// A REAL `.js` module, imported by the name it actually has.
//
// `extensionAlias` REPLACES an extension rather than adding to it, so a table
// mapping `.js` to the TypeScript sources alone stops resolving this file — the
// nodenext mapping and plain JavaScript are the same entry, and closing one
// half over the other is silent. The tree carries no other `.js` source, so
// nothing else here reaches that case.
import postgres from "postgres";

export const legacyRate = (n) => {
  void postgres;
  return n;
};
