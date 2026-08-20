// The SECOND importer of `unreadable-escaping-link`, and that is its whole job.
//
// An unreadable grant file is one finding about the file, not one per feature
// that imports it — the enumerated arm gets that free by walking features, and
// the escaped arm has to buy it, because it fires from inside a loop over EDGES.
// With `salvager` alone, per-edge and per-feature emission are the same one
// finding and the guard that holds them apart can be deleted with the whole
// suite green.
//
// The multiset is the assertion: a second identical FAIL at
// `unreadable-escaping-link/visibility.json` is reported as SPURIOUS, since the
// expectation lists that path once.
import { salvagedValue } from "@/features/unreadable-escaping-link/index.ts";

export const scavenged = salvagedValue;
