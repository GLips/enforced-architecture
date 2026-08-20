// FIRES feature-visibility: an ungranted import that names the importee through
// a SYMLINK rather than through its own directory name.
//
// The map of grant files is keyed by directory names as the filesystem spells
// them; `classify` derives the importee from the resolved specifier text. This
// is the portable case where those two disagree — the resolver loads real code
// under a name the listing does not contain — so a check that looks the importee
// up and skips on a miss has a hole in deny-by-default, reachable by writing
// ordinary code. The other case that separates them, a case-mismatched specifier
// on a case-insensitive filesystem, cannot live in a shared fixture tree: it
// would pass on macOS and fail on the Linux runner.
import { targetCore } from "@/features/aliased-link/index.ts";

export const viaLink = targetCore;
