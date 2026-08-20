// FIRES feature-visibility, as UNREADABLE rather than ungranted: the importee is
// a symlink out of the features root whose visibility.json does not parse.
//
// The arm that reports a malformed grant file walks the enumeration, and the
// enumeration lists directories — never a link. So the file is unparseable AND
// unreported, the deny arm's "a malformed file already reported itself" skip is
// false here, and every import of the feature is allowed in silence. One typo
// in a vendored grant file would otherwise reopen the whole hole `escaping-link`
// next door exists to close, which makes it an off-switch an adopter can reach
// by accident.
//
// The wording is the assertion. The path and severity are identical to the
// denial `escaping-link` produces, so only the message separates "your JSON is
// broken" from "add a grant" — and the second is an edit that cannot be made
// until the first is done.
import { salvagedValue } from "@/features/unreadable-escaping-link/index.ts";

export const salvaged = salvagedValue;
