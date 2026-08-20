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
    // alpha imports beta across 9 files, every one of them spelled RELATIVELY
    // (`../../beta/service/beta-thing.ts`). An implementation that pattern-matches
    // `@/features/<name>` in the specifier text passes all of them in silence
    // while still catching the `closed` case above. Feature ends have to come
    // from the resolved classification; this entry is what proves they do.
    //
    // ONE finding, not nine: the edge is the subject, and the importing files are
    // listed inside the message.
    "FAIL src/features/beta/visibility.json",
    // renderer imports shapes with a TYPE-ONLY import, which emits no runtime
    // code — both of Bun's scans drop it, so a graph built from the reader alone
    // has no edge here and this check reports nothing while still catching every
    // runtime crossing in the tree. The miss is invisible from the check's own
    // output; only the graph's reveal pass puts the edge back.
    "FAIL src/features/shapes/visibility.json",
    // courier imports `hidden`, a feature made entirely of `.mts`. The grant-file
    // enumeration globs `**/*.{ts,tsx}` and the import graph globs
    // `**/*.{ts,tsx,mts,cts}`, so the graph hands over an edge into a feature the
    // enumeration has never heard of. Every other firing case here reaches an
    // enumerated importee and passes whether the unknown case denies or is
    // skipped; this one separates them, and the skipped reading is
    // allow-by-default for exactly the features nobody listed.
    "FAIL src/features/hidden/visibility.json",
    // bribed grants briber with an EMPTY justification, and briber imports
    // bribed. Honour the entry and the edge is granted and the check falls
    // silent — so the assertion is a FAIL that only exists because the file is
    // rejected whole. An empty grant with no matching edge would be reported
    // either way, as malformed or as stale, and prove nothing.
    "FAIL src/features/bribed/visibility.json",
    // nulled/visibility.json is the literal `null`. It parses, and it is not an
    // object. `broken` (unparseable) and `bribed` (empty justification) both
    // leave this disjunct untouched, and without a `null` file in the tree it can
    // be deleted with nothing happening at all. With one, deleting it makes
    // `Object.entries(null)` throw — and the orchestrator catches that and says
    // the check threw and reported nothing, which is the loud failure it exists
    // to produce. The fixture is what turns a silent deletion into that noise.
    "FAIL src/features/nulled/visibility.json",
    // stray imports `aliased-target` through `aliased-link`, a symlink beside it.
    // The grant-file map is keyed by directory names as the filesystem SPELLS
    // them; `classify` derives the importee from the resolved specifier text, so
    // the resolver reaches real code under a name the listing does not contain.
    // A check that looks the importee up and skips on a miss is deny-by-default
    // with a hole in it. This is the portable half of that case — the other,
    // a case-mismatched specifier, passes on macOS and fails on the Linux runner,
    // so it is stated in the rule's negative space instead of fixtured.
    "FAIL src/features/aliased-link/visibility.json",
    // listed/visibility.json is a JSON ARRAY. It parses and it is an object, so
    // it reaches the rejection through neither of the arms above — and dropping
    // just this disjunct is not a crash and not a wording change:
    // `Object.entries([])` returns `[]`, so the file quietly becomes an empty
    // grant map and every edge into the feature is denied with the ORDINARY
    // ungranted-edge message. That sends the author to add a grant to a file
    // whose shape is the actual problem.
    "FAIL src/features/listed/visibility.json",
    // A feature directory holding no source at all, only a grant file. It is
    // invisible to `occupiedDirs` — whose occupancy test exists so an empty
    // directory cannot manufacture a feature for `graph/feature-deps` — and it
    // is exactly what this rule audits, because a leftover directory is where a
    // grant outlives not just its import but its whole feature.
    "WARN src/features/leftover/visibility.json",
    // registrar grants `leftover`, which IS a real feature directory and holds
    // no source. Nothing but the wording separates the two stale-grant branches
    // here, and `leftover` is the only name in this tree that one walker calls a
    // feature and the other does not — so this is the single case that proves
    // the branch oracle asks the same question the deny arm asks.
    "WARN src/features/registrar/visibility.json",
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
    // `hidden`'s twin: the same `.mts`-only shape, but it grants its importer.
    // `hidden` proves an unenumerated feature is DENIED; only this proves the
    // deny can be CLEARED. A rule that hard-codes absence for features its
    // enumeration missed passes `hidden` and fails here — and the gap between
    // those two is an author who writes exactly the grant the message asks for
    // and watches nothing change.
    "src/features/remote/visibility.json",
    // The cycle cluster, granted in every direction. `graph/feature-deps` fails
    // on these features and this check must not — the two questions are
    // independent, and a grant is a complete answer to exactly one of them.
    "src/features/cycle-a/visibility.json",
    "src/features/ring-one/visibility.json",
    "src/features/leaf/visibility.json",
  ],

  // The branches whose only distinguishing output is their wording. Every path
  // assertion above is satisfied by a check that reports the right number of
  // findings at the right addresses saying the wrong thing.
  messages: [
    // The malformed file must report ITSELF. Path and severity alone cannot say
    // that: a check that dropped the parse branch and kept the deny-all one
    // reports exactly one error at exactly this address, and passes everything
    // above.
    { path: "src/features/broken/visibility.json", contains: "is unreadable" },
    // ...and the `absent` half states the branch is NARROW. It is not aimed at a
    // check that emits the deny-all violation as a SECOND finding — the multiset
    // catches that as SPURIOUS before wording is consulted. What it uniquely
    // catches is the malformed sentence being WIDENED to argue the deny-all case
    // too, inside the one finding: same path, same severity, same count, and a
    // reader handed an argument they cannot act on until the JSON parses.
    { path: "src/features/broken/visibility.json", absent: "has not granted it" },
    // The parse branch is not one branch. `bribed` reaches the rejection through
    // the entry-level check rather than JSON.parse, and a check that dropped that
    // arm reports nothing at all here rather than a differently-worded finding.
    { path: "src/features/bribed/visibility.json", contains: "needs a non-empty justification string" },
    // ...and `nulled` reaches it through the third arm again, which is why all
    // three carry a wording assertion: the path multiset cannot tell one
    // rejected file from another, and these are the sentences that say which
    // edit clears it.
    { path: "src/features/nulled/visibility.json", contains: "must be a JSON object" },
    { path: "src/features/listed/visibility.json", contains: "must be a JSON object" },
    // The load-bearing half of the branch-oracle case. `leftover` is a real
    // feature, so this grant is stale rather than misspelled, and the reader
    // belongs at "drop the entry" rather than at "fix the name". An oracle keyed
    // off the narrower walker sends them to correct a spelling that is already
    // right — same path, same severity, same count, and only the sentence moves.
    { path: "src/features/registrar/visibility.json", absent: "is not a feature" },
    // The two stale-grant branches, which differ in wording and nothing else.
    // Both entries have to hold, so a check that collapsed them to one sentence
    // fails one of them while the WARN count stays at two.
    { path: "src/features/stale/visibility.json", contains: "imports nothing from stale" },
    { path: "src/features/stale/visibility.json", contains: "is not a feature" },
  ],
};
