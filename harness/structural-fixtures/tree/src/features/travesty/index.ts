// FIRES barrel-purity: the same escape on a RE-EXPORT, which the grammar puts on
// the export record rather than the import one. Three records can produce a
// specifier — import, export, and the AST for dynamic and CommonJS forms — and
// each reads the cooked value separately, so each needs its own fixture.
export { chargeThrice } from "./service/charge-thric\u0065.ts";
