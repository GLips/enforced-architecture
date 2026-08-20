// LEGAL: an edge whose two ends sit in layers of DIFFERENT features. Silent.
//
// consumer/repo reaches provider/service. Rank the two ends against each other
// and this is an upward edge — service outranks repo — so the check reports it
// the moment the same-feature guard goes. It is not upward: `repo` in consumer
// and `service` in provider are not two rungs of one ladder, and there is no
// direction between them to be wrong about.
//
// What makes this pair the only one that separates the guard from its absence is
// the DIRECTION, not the crossing. Most of the tree's cross-feature edges land on
// a barrel — or on a loose file at the features root — which sits in no layer, so
// the rank arm never reaches them at all. The alpha/ui crossings into
// beta/service do have a layer on both ends, and they rank downward, so the rank
// arm passes them whether the guard is there or not. An upward-ranked
// cross-feature pair is what is needed, and this is the tree's only one; without
// it the guard can be deleted with the whole suite green.
//
// Spelled through the alias deliberately. `boundary/import-policy` reads
// relative edges only — the aliased half belongs to the oxlint tier, which does
// not run over this tree — so this file's one structural verdict is this
// check's, and a failure here can mean nothing else.
//
// "Legal" here means NO STRUCTURAL CHECK OWNS THIS EDGE, not that the code is
// allowed. The oxlint tier denies it: a repo layer may not reach a feature at
// all, so `arch/import-policy` reports `deniedDirection` on this exact line in a
// real project. Do not read this file as a permitted pattern.
//
// The pair is already granted (provider grants consumer), which is what keeps
// `api/feature-visibility` silent, and it adds a second file to a pair well
// under saturation rather than a new edge to `graph/feature-deps`.
import { seatCount } from "@/features/provider/service/seat-count.ts";

export const cachedSeats = seatCount;
