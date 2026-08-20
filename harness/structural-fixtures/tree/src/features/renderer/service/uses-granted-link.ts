// LEGAL: a GRANTED import that names its importee through a SYMLINK, with the
// grant written in the real directory's visibility.json. Silent — and silent is
// the whole assertion.
//
// This is the step `aliased-link` stops short of. That fixture proves an
// ungranted aliased import is denied; without this one, a check that treats the
// two names as two features still passes it — and then the author does exactly
// what the failure message says, writes the grant in the real file, and gets a
// stale-grant warning telling them to delete what they just wrote. Delete it and
// the error comes back. An unclearable finding is invisible to every fixture
// that only ever checks the denial.
import { grantedValue } from "@/features/granted-link/index.ts";

export const shapeLabel = `shape:${grantedValue}`;
