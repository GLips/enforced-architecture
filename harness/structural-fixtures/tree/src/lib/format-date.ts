// FIRES topology: a new top-level directory that is not a layer.
//
// Nothing stopped `src/lib/` from existing, and every rule in the catalog keys
// on a path pattern that names a layer — so this file is governed by none of
// them. It is the obvious half of the check, and the half a reader spots.
//
// If the first-segment whitelist stops matching, this address goes silent and
// with it every future `src/utils/`, `src/helpers/`, `src/common/`: a whole
// parallel tree where none of the architecture applies.
//
// It also FIRES import-policy, once, for the same reason from the other side: a
// file in no area has no row, so nothing it imports is checked and nothing says
// so. The two relative imports below are what make the count the assertion —
// being in no area is a fact about the FILE, so a second import must not produce
// a second finding.
import { sharedThing } from "../shared/lib/shared-thing.ts";
import { rootThing } from "../root-neighbour.ts";

export const provenance = `${sharedThing}${rootThing}`;

export function formatDate(at: Date): string {
  return at.toISOString().slice(0, 10);
}
