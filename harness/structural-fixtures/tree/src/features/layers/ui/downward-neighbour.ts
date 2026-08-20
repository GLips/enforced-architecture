// LEGAL for layer-direction: the downward import, which is the whole point of
// having layers. A check that reports the normal, correct direction is one that
// gets switched off within a week, taking the upward edges it was written for
// with it.
//
// The specifier is `../service/queries.ts`, character for character the one
// repo/plain-upward.ts is reported for. Only the importing file's own layer
// separates them, so a check matching the string reports this too.
//
// FIRES layer-occupancy, and this is the whole reason both checks exist. The
// edge runs the right way and still skips an occupied `controllers/` — a skip,
// not a reversal, which `layer-direction` is silent on by construction. Nothing
// about it involves a controller as the IMPORTER either, so a check gated on the
// source layer never examines it at all.
export { listRows } from "../service/queries.ts";
