// LEGAL: the nesting-suffix trap. Silent.
//
// This name ends with `.test.ts` as well as with `.integration.test.ts`. Strip
// the shorter of the two matches and the base becomes `imports.integration`,
// which no file is named — so a correctly mirrored test is reported as an
// orphan, on the one test kind least likely to be renamed in response.
export const ledgerImportCases = ["csv", "ofx"];
