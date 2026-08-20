// LEGAL: relative imports that stay inside features/alpha. They must stay
// silent — relative paths are the normal, correct way to move within one
// boundary, and a check that reports them is one that gets switched off.
//
// The climb here is `../`, the same shape the fires-cases use. What separates
// them is only where it lands, so a check that keys on the number of `../`
// segments rather than the resolved target reports this file too.
export { alphaThing } from "../service/alpha-thing.ts";
export { siblingModule } from "./sibling-crossing.ts";
