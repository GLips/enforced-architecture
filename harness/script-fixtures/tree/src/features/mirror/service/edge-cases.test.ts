// FIRES test-file-mirror: an orphan test. No `edge-cases.ts` or `edge-cases.tsx`
// sits beside it, so a search for the code it covers never turns it up and an
// agent editing that code never learns this test constrains it.
//
// Every other test file in this feature mirrors a source, so if the sibling
// lookup stops running this is the only file left to say so. It asserts nothing
// on purpose: the check reads names, never contents.
export const edgeCasesUnderTest = ["empty", "duplicate"];
