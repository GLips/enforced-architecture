// FIRES topology: a file directly in the subdivided directory. It belongs to no
// feature, and topology is the rule that says so.
//
// `classify` does NOT scope past it — it reads this file as a feature named
// `orphan-module.ts` — so the feature-scoped rules are each handed it and have
// to decide. `features/stray/service/reaches-past-a-feature.ts` imports it, so
// what they decide is exercised rather than merely true of a tree where nothing
// happens to import this file:
//
//   - `api/feature-visibility` skips it deliberately. Denying it would file at
//     `orphan-module.ts/visibility.json`, a path nobody can create.
//   - `graph/feature-deps` does not skip it. Its node set comes from
//     `occupiedDirs`, which lists directories, but its EDGE set comes from
//     `classify` — so this file is never a subject and still counts toward the
//     total-edge number and toward `stray`'s fan-out. No verdict moves today,
//     which is the only reason that inconsistency is quiet.
//
// Distinct from `scanner/helpers.ts` next door, which at least sits inside a
// boundary. This one has no boundary at all, and an implementation that starts
// matching at `features/<name>/<layer>` reads `orphan-module.ts` as the name.
export const orphanModule = "no boundary owns this";
