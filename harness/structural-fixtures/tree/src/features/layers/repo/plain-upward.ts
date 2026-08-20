// FIRES layer-direction: the shortest spelling of an upward import. repo is the
// floor of the stack and reaches one rung up into service.
//
// This is the case the check's own doc names, and the only one a specifier
// pattern gets right — `../service/` is literally in the string. It is here as
// the regression guard: resolving properly had to keep what a pattern already
// caught, and the two adversarial siblings are what a pattern loses.
export { listRows } from "../service/queries.ts";
