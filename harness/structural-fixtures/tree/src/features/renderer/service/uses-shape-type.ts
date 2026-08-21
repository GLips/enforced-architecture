// FIRES feature-visibility: an ungranted cross-feature import that is TYPE-ONLY,
// so it emits no runtime code.
//
// A graph built from a reader that answers "what does the emitted module need"
// has no edge here at all, and this check then reports nothing while still
// catching every runtime crossing in the tree — the miss is invisible from the
// check's own output.
//
// A type crossing a feature boundary is still coupling: shapes cannot reshape
// ShapeSpec without breaking renderer, and erasure at runtime buys no exemption.
// The finding is filed against shapes/visibility.json, which does not exist —
// no file means no grants, and the default is deny.
import type { ShapeSpec } from "@/features/shapes/index.ts";

export const emptyShape: ShapeSpec = { id: "", sides: 0 };
