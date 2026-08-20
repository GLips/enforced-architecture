// LEGAL: a primitive importing a sibling primitive. It must stay silent.
//
// This is the flip side of shared-crossing.ts next door, and the reason the
// distinction has to be UNIT identity rather than directory depth: both files
// climb out of `shared/ui/` in the specifier and only one of them leaves the
// unit. A check that keys on `../` reports this one too, and a check that keys
// on the boundary reports neither.
export { spacing } from "./theme.ts";
