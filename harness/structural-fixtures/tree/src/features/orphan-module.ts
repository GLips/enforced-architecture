// FIRES topology: a file directly in the subdivided directory. It belongs to no
// feature, so every feature-scoped rule keys on a feature name and scopes past
// it — `graph/feature-deps`, `api/feature-visibility` and the layer rules all
// read straight over this file without a word.
//
// Distinct from `scanner/helpers.ts` next door, which at least sits inside a
// boundary. This one has no boundary at all, and an implementation that starts
// matching at `features/<name>/<layer>` reads `orphan-module.ts` as the name.
export const orphanModule = "no boundary owns this";
