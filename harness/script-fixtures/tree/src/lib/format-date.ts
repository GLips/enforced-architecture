// FIRES topology: a new top-level directory that is not a layer.
//
// Nothing stopped `src/lib/` from existing, and every rule in the catalog keys
// on a path pattern that names a layer — so this file is governed by none of
// them. It is the obvious half of the check, and the half a reader spots.
//
// If the first-segment whitelist stops matching, this address goes silent and
// with it every future `src/utils/`, `src/helpers/`, `src/common/`: a whole
// parallel tree where none of the architecture applies.
export function formatDate(at: Date): string {
  return at.toISOString().slice(0, 10);
}
