import type { CheckFixtures } from "../../expectations.ts";

export const featureDepsFixtures: CheckFixtures = {
  check: "graph/feature-deps",

  // Every cycle edge below is FULLY GRANTED in the importee's visibility.json.
  // That is deliberate and it is the whole reason the two checks sit next to
  // each other: `api/feature-visibility` reports nothing against these features,
  // and the cycles here still hard-fail. If a change ever makes one of these
  // findings disappear because a grant was added, the check has stopped asking
  // its question and started asking the other one's.
  obvious: [
    // cycle-a <-> cycle-b, filed against the alphabetically first participant.
    // A cycle is a property of the component, so the address has to be stable
    // for as long as the cycle is — blaming whichever file closes it moves the
    // finding on unrelated edits.
    "FAIL src/features/cycle-a",
    // Fan-out: hub imports cycle-a, ring-one, and leaf. Acyclic and granted
    // throughout; the finding is about width, not legality.
    "WARN src/features/hub",
    // Total edges over the threshold (4), filed against the features
    // directory because no single feature owns the number.
    "WARN src/features",
  ],

  adversarial: [
    // ring-one -> ring-two -> ring-three -> ring-one. No PAIR in this ring is
    // mutual, so the implementation everyone writes first — does A import B and
    // B import A — reports it clean while still passing the cycle-a/cycle-b
    // case above. This entry is what decides whether the SCC pass is real.
    "FAIL src/features/ring-one",
    // Pair saturation, alpha -> beta across 9 files. Every one of those 9 is
    // spelled RELATIVELY (they are `boundary/import-policy`'s fixtures),
    // so a check that counts `@/features/<name>` specifiers finds zero files on
    // this pair and never warns. Reading the resolved graph is what makes the
    // two spellings one edge; nothing else here would catch the substitution.
    "WARN src/features/alpha",
  ],

  legal: [
    // The other end of each cycle. One cycle must report ONCE, at one address —
    // a check that files against every participant doubles its own output and
    // teaches people the count is noise.
    "src/features/cycle-b",
    "src/features/ring-two",
    // Imported by hub, importing nothing. An edge on its own is not a finding.
    "src/features/leaf",
    // The importee of the 8-file pair. Saturation is the importer's problem —
    // beta cannot fix it and should not be told to.
    "src/features/beta",
  ],
};
