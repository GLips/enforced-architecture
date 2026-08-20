// LEGAL: a cross-feature import the importee GRANTED. Silent.
//
// This is the only positive evidence that a grant is honoured at all. Without
// it, an implementation that reported every cross-feature edge regardless of
// visibility.json would still pass every firing case here — over-matching is
// invisible to positive fixtures, and this rule's over-match reports correct,
// deliberately-declared architecture.
import { seatCount } from "@/features/provider/index.ts";

export const doubled = seatCount * 2;
