// LEGAL: relative imports that stay inside features/alpha. They must stay
// silent — relative paths are the normal, correct way to move within one
// boundary, and a check that reports them is one that gets switched off.
//
// The climb here is `../`, the same shape the fires-cases use. What separates
// them is only where it lands, so a check that keys on the number of `../`
// segments rather than the resolved target reports this file too.
//
// LEGAL for layer-occupancy, and it is that check's absence witness. This is
// `ui -> service` — byte for byte the edge `features/layers/ui/downward-
// neighbour.ts` is reported for — but alpha has NO `controllers/` directory, so
// the edge skips nothing. A feature with no controllers is a feature that did
// not need one. Weaken occupancy to "any intermediate layer" and this file
// reports, which is the version that reads length as bypass.
export { alphaThing } from "../service/alpha-thing.ts";
export { siblingModule } from "./sibling-crossing.ts";
