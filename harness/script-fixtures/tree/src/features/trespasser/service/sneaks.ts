// FIRES feature-visibility: an ungranted cross-feature import, written as an
// alias. The finding is filed against closed/visibility.json rather than here —
// the grant is the importee's to make, and pointing at the file where the fix
// lands is half of what the rule teaches.
import { rate } from "@/features/closed/index.ts";

export const doubledRate = rate * 2;
