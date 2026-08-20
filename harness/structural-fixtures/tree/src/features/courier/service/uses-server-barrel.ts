// LEGAL: a GRANTED cross-feature import that lands on `index.server` rather
// than the client barrel. Silent.
//
// The grant in dispatch/visibility.json names the feature, not a file, so it has
// to be honoured here exactly as it would be through `index.ts`. An
// implementation that only reconciles grants against client-barrel edges — the
// plausible one, given how many rules in this tier special-case index.server —
// reports this correct, deliberately-declared edge, and no firing fixture can
// tell, because over-matching is invisible to every positive case.
import { dispatchPlanVersion } from "@/features/dispatch/index.server.ts";

export const requoteAfter = dispatchPlanVersion + 1;
