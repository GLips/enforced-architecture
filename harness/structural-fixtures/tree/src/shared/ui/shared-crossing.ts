// FIRES import-policy: THE hole this check was rebuilt around.
//
// `src/shared/ui/**` and `src/shared/**` are ONE boundary, so the check this
// replaces — which reported a relative import only when its two ends classified
// to different boundaries — saw nothing here. The aliased rule for shared/ui
// matched only `@/` specifiers, so it saw nothing either. A primitive reaching a
// shared helper was governed by exactly nothing, in the layout the catalog
// itself recommends.
//
// The policy engine draws the line one level finer: two UNITS, one boundary. The
// edge is permitted — a primitive may use a shared helper — so what is reported
// is the spelling, which is the whole of what was missing.
export { sharedThing } from "../lib/shared-thing.ts";
