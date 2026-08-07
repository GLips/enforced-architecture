// FIRES test-file-mirror: the `.spec.` spelling, sitting beside the very source
// it covers.
//
// That placement is what makes it adversarial. The orphan branch asks "is there
// a source of this base name" — and there is, so it has nothing to say here.
// Only a matcher for off-convention NAMES sees this file at all, and without one
// a project half-converted to `.test.` keeps a second convention nobody greps
// for. This file is also not in the global test exclusion, so every other check
// scans it as ordinary source.
export const pricingCases = ["free", "pro"];
