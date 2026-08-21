// ADVERSARIAL: features/shadow's trick, spelled without parentheses.
//
// One shadow spelling per feature, on purpose: `rebindsName` answers yes if ANY
// binding form matches, so three spellings in one file would leave two of the
// three forms deletable with the fixture still red. Separate features are what
// make each form individually revert-probeable.
export { settleCurtain } from "./controllers/settle.ts";
