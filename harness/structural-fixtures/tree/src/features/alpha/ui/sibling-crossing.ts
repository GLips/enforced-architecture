// FIRES cross-boundary-alias: the sibling-feature crossing, the case a
// specifier matcher cannot see.
//
// Such a matcher looks for a literal `features/` segment in the specifier. From
// `features/alpha/ui/`, a sibling feature is reached as `../../beta/…` — the
// path never contains `features/`, so the branch never fired. It is also the
// SHORTEST spelling of a crossing and the most innocuous to read, which is what
// makes it the likeliest one to be written.
//
// Nothing about this string says it leaves alpha. Only resolving it against
// this file's own location does, which is the whole reason this check is a
// script and not a pattern.
export { betaThing } from "../../beta/service/beta-thing.ts";
