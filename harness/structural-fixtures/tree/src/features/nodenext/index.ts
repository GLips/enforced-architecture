// FIRES barrel-purity TWICE: both hops are spelled with the extension
// TypeScript EMITS rather than the one on disk. Under
// `moduleResolution: "nodenext"` that spelling is not exotic, it is mandatory,
// so an entire ordinary project style resolved to nothing here.
//
// The two hops are `.ts` and `.tsx` behind the SAME `.js` spelling, and they
// are two fixtures rather than one because they were two holes. A `.tsx` module
// emits `.js` under the default `jsx: "react-jsx"` — not `.jsx` — so a mapping
// that gives `.js` only `.ts` follows the first hop and loses the second. That
// was this file's first state: one finding, the component chain silent, and the
// suite green.
//
// `ledger` next door is the pair's twin from the other side: an EXTENSIONLESS
// specifier, which the old suffix list could resolve because it only ever
// appended. Nothing it appended could turn `.js` into `.ts`.
export { settle } from "./service/settlement.js";
export { Chart } from "./ui/Chart.js";
// The third hop is a `.js` file that IS one. See `legacy-rates.js`.
export { legacyRate } from "./service/legacy-rates.js";
