// FIRES feature-visibility: an ungranted import of a feature the grant-file
// enumeration cannot see, because that enumeration and the import graph walk
// different extensions.
//
// Every other firing case in this tree reaches an importee that IS enumerated,
// so all of them pass whether the absent case denies or is skipped. This one
// separates them: skip it and the check reports nothing here while still
// catching `closed`, `beta`, and `shapes`.
import { hiddenValue } from "@/features/hidden/index.mts";

export const probed = hiddenValue;
