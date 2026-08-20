// FIRES import-policy: the long climb out to another top-level
// boundary. A specifier matcher does catch this one, so it is here as the
// regression guard — resolving imports properly had to keep what a pattern
// already got right, not just add the case it missed.
//
// Written as a side-effect import on purpose. An extractor that only handles
// `from "…"` sees no edge here at all, and a crossing spelled this way would
// be invisible for a reason that has nothing to do with boundaries.
import "../../../shared/lib/shared-thing.ts";
