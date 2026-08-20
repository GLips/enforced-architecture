// FIRES test-file-mirror: an orphan test with no sibling module, written as an
// ES module.
//
// The suffix list once spelled the extension into each entry (".test.ts",
// ".test.tsx") while the walker accepted eight, so this file was not recognised
// as a test at all and the check that exists to make tests findable said nothing
// about it. It is also not architecture-exempt under an extension-listing
// exemption regex, which is the other half of the same hole.
export const missingSibling = true;
