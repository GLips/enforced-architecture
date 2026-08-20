import type { CheckFixtures } from "../../expectations.ts";

export const featureVisibilityFixtures: CheckFixtures = {
  check: "api/feature-visibility",

  // Findings are filed against the IMPORTEE's visibility.json, including when
  // that file does not exist yet. That is where the fix lands, and pointing at
  // it is half of what the rule teaches: the grant is the importee's to make.
  obvious: [
    // trespasser imports `@/features/closed/index.ts`; closed has no
    // visibility.json, so it grants nobody.
    "FAIL src/features/closed/visibility.json",
  ],

  adversarial: [
    // alpha imports beta across 8 files, every one of them spelled RELATIVELY
    // (`../../beta/service/beta-thing.ts`). An implementation that pattern-matches
    // `@/features/<name>` in the specifier text passes all 8 in silence while
    // still catching the `closed` case above. Feature ends have to come from the
    // resolved classification; this entry is what proves they do.
    //
    // One finding, not eight: the edge is the subject, and the 8 importing files
    // are listed inside the message.
    "FAIL src/features/beta/visibility.json",
    // renderer imports shapes with a TYPE-ONLY import, which emits no runtime
    // code — both of Bun's scans drop it, so a graph built from the reader alone
    // has no edge here and this check reports nothing while still catching every
    // runtime crossing in the tree. The miss is invisible from the check's own
    // output; only the graph's reveal pass puts the edge back.
    "FAIL src/features/shapes/visibility.json",
    // broken/visibility.json does not parse. ONE finding — the file itself.
    // trespasser imports broken, and treating an unreadable file as deny-all
    // would add a second finding that buries the only one worth reading under a
    // violation the author cannot act on until the JSON is fixed anyway.
    "FAIL src/features/broken/visibility.json",
    // Two stale grants in one file, and the multiset is what holds them apart:
    // stale grants "alpha" (a real feature that imports nothing from stale) and
    // "ghost" (not a feature at all). They take different messages and an
    // implementation that only audits grants naming real features drops the
    // second while the first still passes.
    "WARN src/features/stale/visibility.json",
    "WARN src/features/stale/visibility.json",
  ],

  legal: [
    // A granted edge, aliased: consumer imports provider, provider grants it.
    "src/features/provider/visibility.json",
    // A granted edge landing on `index.server` rather than the client barrel.
    // dispatch ships both barrels, so which one courier names is a choice rather
    // than the only option. The grant covers the FEATURE — an implementation
    // that reconciles grants only against client-barrel edges reports this
    // correct, declared architecture, and no firing fixture can tell.
    "src/features/dispatch/visibility.json",
    // The cycle cluster, granted in every direction. `graph/feature-deps` fails
    // on these features and this check must not — the two questions are
    // independent, and a grant is a complete answer to exactly one of them.
    "src/features/cycle-a/visibility.json",
    "src/features/ring-one/visibility.json",
    "src/features/leaf/visibility.json",
  ],

  // Four branches whose only distinguishing output is their wording. Every path
  // assertion above is satisfied by a check that reports the right number of
  // findings at the right addresses saying the wrong thing.
  messages: [
    // The malformed file must report ITSELF. Path and severity alone cannot say
    // that: a check that dropped the parse branch and kept the deny-all one
    // reports exactly one error at exactly this address, and passes everything
    // above.
    { path: "src/features/broken/visibility.json", contains: "is unreadable" },
    // ...and the `absent` half is what states the branch is NARROW. trespasser
    // does import broken, so a deny-all violation here is available to be
    // reported and is the thing this case is the witness against: it would bury
    // the one real error under a violation nobody can act on until the JSON
    // parses.
    { path: "src/features/broken/visibility.json", absent: "has not granted it" },
    // The two stale-grant branches, which differ in wording and nothing else.
    // Both entries have to hold, so a check that collapsed them to one sentence
    // fails one of them while the WARN count stays at two.
    { path: "src/features/stale/visibility.json", contains: "imports nothing from stale" },
    { path: "src/features/stale/visibility.json", contains: "is not a feature" },
  ],
};
