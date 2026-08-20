// LEGAL: a feature's public barrel, at the feature root. Silent.
//
// Same address as `helpers.ts`, same directory as `errors.ts`. If the feature-
// root whitelist is dropped, the very file every other feature is required to
// import through becomes a topology violation — which is how a blocking check
// gets disabled wholesale rather than fixed.
//
// The re-export is named rather than `export *` and unrenamed, so
// `naming/barrel-discoverability` stays quiet, and it reaches nothing outside
// this feature, so `api/barrel-purity` and `boundary/import-policy` do
// too. The feature is deliberately edge-free: nothing here imports another
// feature and nothing imports it.
export { ScannerError } from "./errors.ts";
