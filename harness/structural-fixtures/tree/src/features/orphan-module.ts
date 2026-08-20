// FIRES topology: a file directly in the subdivided directory. It belongs to no
// feature, so every feature-scoped rule keys on a feature name and scopes past
// it — `graph/feature-deps`, `api/feature-visibility` and the layer rules all
// read straight over this file without a word.
//
// `classify` does not scope past it, though: it reads this file as a feature
// NAMED `orphan-module.ts`, so each of those rules skips it on purpose rather
// than by never being handed it. `features/stray/service/reaches-past-a-feature.ts`
// imports it, so that scoping is exercised rather than merely true of a tree
// where nothing happens to import this file.
//
// Distinct from `scanner/helpers.ts` next door, which at least sits inside a
// boundary. This one has no boundary at all, and an implementation that starts
// matching at `features/<name>/<layer>` reads `orphan-module.ts` as the name.
export const orphanModule = "no boundary owns this";
