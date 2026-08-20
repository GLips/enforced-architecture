// LEGAL: an edge whose two ends sit in layers of DIFFERENT features. Silent.
//
// consumer/repo reaches provider/service. Rank the two ends against each other
// and this is an upward edge — service outranks repo — so the check reports it
// the moment the same-feature guard goes. It is not upward: `repo` in consumer
// and `service` in provider are not two rungs of one ladder, and there is no
// direction between them to be wrong about.
//
// The tree's other cross-feature edges all land on a BARREL, which sits in no
// layer, so the rank arm never reaches them — every one of them passes whether
// the guard is there or not. This is the only edge in the tree that separates
// the two, and without it the guard can be deleted with the whole suite green.
//
// Spelled through the alias deliberately. `boundary/import-policy` reads
// relative edges only — the aliased half belongs to the oxlint tier, which does
// not run over this tree — so this file's one structural verdict is this
// check's, and a failure here can mean nothing else.
//
// The pair is already granted (provider grants consumer), which is what keeps
// `api/feature-visibility` silent, and it adds a second file to a pair well
// under saturation rather than a new edge to `graph/feature-deps`.
import { seatCount } from "@/features/provider/service/seat-count.ts";

export const cachedSeats = seatCount;
