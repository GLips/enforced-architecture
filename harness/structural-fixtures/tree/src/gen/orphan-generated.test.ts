// SILENT in test-file-mirror: a test inside a generated directory.
//
// It has no sibling module, so the orphan branch has something to say — and
// nothing anyone can do about it: renaming a generator's output is an edit the
// next run undoes. The check waives the TEST exemption to see its subject at
// all, and waiving every exemption at once is what put this file in its walk.
export const generatedOrphanCases = ["a", "b"];
