// FIRES barrel-purity: the hop is spelled with the extension TypeScript EMITS
// rather than the one on disk — `./service/settlement.js` naming
// `settlement.ts`. Under `moduleResolution: "nodenext"` that spelling is not
// exotic, it is mandatory, so an entire ordinary project style resolved to
// nothing here.
//
// `ledger` next door is this fixture's twin from the other side: an
// EXTENSIONLESS specifier, which the old suffix list could resolve because it
// only ever appended. Nothing it appended could turn `.js` into `.ts`, and its
// own header apologised for that in every message this check emitted rather
// than closing it. Deleting one of the two fixtures leaves the other green.
export { settle } from "./service/settlement.js";
