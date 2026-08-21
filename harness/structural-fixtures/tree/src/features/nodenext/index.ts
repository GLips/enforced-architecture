// FIRES barrel-purity TWICE: both hops are spelled with the extension
// TypeScript EMITS rather than the one on disk. Under
// `moduleResolution: "nodenext"` that spelling is not exotic, it is mandatory,
// so a resolver that cannot follow it is silent across an entire ordinary
// project style.
//
// The two hops are `.ts` and `.tsx` behind the SAME `.js` spelling, and they are
// two fixtures rather than one because either can be resolved without the other.
// A `.tsx` module emits `.js` under the default `jsx: "react-jsx"` — not `.jsx`
// — so a mapping that gives `.js` only `.ts` follows the first hop and loses the
// second: one finding, the component chain silent, and the suite green.
//
// `ledger` next door is the pair's twin from the other side: an EXTENSIONLESS
// specifier, which a suffix list resolves by APPENDING. Appending is exactly
// what cannot turn `.js` into `.ts`, so passing `ledger` says nothing about
// this file.
export { settle } from "./service/settlement.js";
export { Chart } from "./ui/Chart.js";
// The third hop is a `.js` file that IS one. See `legacy-rates.js`.
export { legacyRate } from "./service/legacy-rates.js";
