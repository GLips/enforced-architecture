// LEGAL: the cleared half of the escaping-symlink pair. hoister imports
// `granted-escaping-link`, whose target sits outside the features root and
// carries a visibility.json granting hoister — so this is silent, and silent is
// the whole assertion.
//
// `escaping-link` proves the escaping importee is DENIED. Only this proves the
// denial can be CLEARED by doing what its message says. A check that denies the
// escaping name without reading a grant file at it passes that fixture and fails
// here, and the gap between the two is an author who writes exactly the grant
// they were asked for and watches nothing change.
import { grantedEscapedValue } from "@/features/granted-escaping-link/index.ts";

export const hoisted = grantedEscapedValue;
