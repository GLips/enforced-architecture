// LEGAL: an asset import that resolves across a boundary and must stay silent.
//
// `../styles.css?url` from routes/ lands on src/styles.css — inside the source
// tree, and in a different boundary than routes. Every boundary test this check
// makes says crossing. It is not one: a stylesheet is not a module edge, and
// the styling rules own it.
//
// This is not a hypothetical. routes/__root.tsx imports exactly this today, so
// without the asset exclusion the check reports a false positive against real
// code on its first run — the failure that gets a new check reverted.
import "../styles.css?url";
