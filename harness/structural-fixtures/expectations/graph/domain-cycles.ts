import type { CheckFixtures } from "../../expectations.ts";

export const domainCyclesFixtures: CheckFixtures = {
  check: "graph/domain-cycles",

  // One finding per cycle, filed against the alphabetically first participating
  // domain's DIRECTORY rather than a file. A cycle is a property of the whole
  // component: blaming whichever file happens to close it makes the finding move
  // when an unrelated import is added, and a blocking check that re-baselines on
  // its own is one people learn to re-baseline without reading. The directory is
  // stable for as long as the cycle is.
  obvious: ["FAIL src/domains/billing"],

  adversarial: [
    // The transitive cycle alerts -> quota -> thresholds -> alerts, reported
    // against `alerts` as the alphabetically first member. No PAIR here is
    // mutual, so the natural implementation — does A import B and B import A —
    // reports nothing at all while passing the direct billing/usage case. This
    // is the entry that decides whether the SCC pass works.
    "FAIL src/domains/alerts",
  ],

  legal: [
    // The acyclic chain, both ends. pricing -> catalog and nothing back: a check
    // that reads its edge set as undirected, or that asks only whether two
    // domains are connected, reports these two as a cycle.
    "src/domains/pricing/index.ts",
    "src/domains/catalog/index.ts",
    // A domain importing out to shared/ and back into itself relatively. The
    // first has no domain end; the second has the same boundary at both ends.
    // Counting either as an outgoing edge gives ledger a self-loop.
    "src/domains/ledger/index.ts",
    "src/domains/ledger/errors.ts",
  ],

  messages: [
    // A within-domain import inside a domain that IS in a cycle. The verdict is
    // right either way — the SCC pass needs two members, so a self-edge can
    // never invent a cycle — which is exactly why nothing above can see this.
    // What breaks is the TRAIL: the finding's whole value is the list of imports
    // to go and cut, and "alerts -> alerts" sends someone to a file that is not
    // part of the ring and cannot be removed from it.
    { path: "src/domains/alerts", absent: "alerts -> alerts" },
    // The other half of the same assertion — the trail must still name the ring
    // it does have, so the line above cannot be passed by reporting no trail.
    { path: "src/domains/alerts", contains: "alerts -> quota" },
  ],
};
