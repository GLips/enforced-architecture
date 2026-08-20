// FIRES test-file-mirror: the `test_` prefix, the other off-convention spelling.
//
// Nothing about this name ends in a blessed suffix, so a check assembled from
// `endsWith(".test.ts")` walks straight past it — and because the prefix carries
// the test-ness, the file reads as ordinary source to the global exclusion list
// and to every other check in the tier.
export const totalsCases = ["zero", "refund"];
