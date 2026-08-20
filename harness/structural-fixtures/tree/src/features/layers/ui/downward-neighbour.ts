// LEGAL: the downward import, which is the whole point of having layers. ui
// reaching into service must stay silent — a check that reports the normal,
// correct direction is one that gets switched off within a week, taking the
// upward edges it was written for with it.
//
// The specifier is `../service/queries.ts`, character for character the one
// repo/plain-upward.ts is reported for. Only the importing file's own layer
// separates them, so a check matching the string reports this too.
export { listRows } from "../service/queries.ts";
