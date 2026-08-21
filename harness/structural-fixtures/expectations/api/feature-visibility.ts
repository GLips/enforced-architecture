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
    // code — so a graph built by asking what the emitted module needs has no edge
    // here, and this check reports nothing while still catching every runtime
    // crossing in the tree. The miss is invisible from the check's own output.
    "FAIL src/features/shapes/visibility.json",
    // courier imports `hidden`, a feature made entirely of `.mts` — invisible to
    // the occupancy walker, which globs `**/*.{ts,tsx}`, and visible to the
    // enumeration, which lists directories.
    //
    // Written as the case that separated "deny an importee nobody enumerated"
    // from "skip it", back when the enumeration was that same `.ts` glob. It no
    // longer is: `subdirs` lists any directory, and the deny arm reads a grant
    // file for any importee the map lacks, so this denial now survives either
    // walker. `escaping-link` below is where that separation lives. What is left
    // here is end-to-end cover for a feature shape the walkers disagree about,
    // and it is cheap; `remote` is its cleared twin.
    "FAIL src/features/hidden/visibility.json",
    // stalepath imports a module of `mislaid` that NO FILE ON DISK BACKS — the
    // module was renamed away, and the specifier still names the position it
    // used to hold. The crossing is real and ungranted whether or not the far
    // end is currently there, so the graph has to keep the edge.
    //
    // This is the only fixture in the tree that reaches the resolver's
    // unresolved arm: everything else resolves, so a graph that DROPPED what it
    // cannot follow passes every other case here while quietly answering "not a
    // boundary question" for an import that plainly crosses one. It is
    // feature-visibility's entry only because this check is the one that reports
    // it; what it holds down is the substrate underneath every check in the tier.
    "FAIL src/features/mislaid/visibility.json",
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
    // `classify` names the importee from the specifier text, so the resolver
    // reaches real code under a name no directory listing contains — and a check
    // that looks that name up and skips on a miss is deny-by-default with a hole
    // in it, reachable by writing ordinary code.
    //
    // The ADDRESS is the second half of the assertion. It is the target, not the
    // link: the finding has to name the file an author can open and edit, and a
    // check that collapses the two names anywhere later than here files against
    // whichever spelling the import happened to use. `granted-target` below is
    // the same pair with the grant written, and the two only pass together.
    "FAIL src/features/aliased-target/visibility.json",
    // hoister imports `escaping-link`, a symlink whose target is not in the tree
    // at all — `vendor/escaping-target`, the shape vendoring and monorepo
    // hoisting produce. `aliased-link` above is the same spelling problem with
    // the target beside it, and it passes with this hole wide open: that name
    // folds onto an ENUMERATED directory, and this one folds onto nothing, so
    // only this fixture separates "resolve the name" from "resolve the name and
    // then answer not-a-feature when the listing has never heard of it".
    //
    // The address is the LINK, not the target: `vendor/…` is a path no
    // features/ vocabulary can name, and a finding nobody can clear is worth no
    // more than the silence it replaces. `granted-escaping-link` below is the
    // same pair with the grant written, and the two only pass together.
    "FAIL src/features/escaping-link/visibility.json",
    // The same escaping link with an UNPARSEABLE grant file. `broken` above is
    // this case for an enumerated feature, and it passes with this one wide
    // open: the arm that reports a malformed file walks the enumeration, so for
    // a link out of the tree the file is unparseable AND unreported, and the
    // deny arm's "it already reported itself" skip then allows every import of
    // the feature in silence. One typo, and the hole `escaping-link` closes is
    // back — an off-switch an adopter reaches by accident.
    //
    // ONE finding for the same reason `broken` is one: the denial is suppressed
    // in favour of the error the author has to fix first. See `messages`.
    "FAIL src/features/unreadable-escaping-link/visibility.json",
    // listed/visibility.json is a JSON ARRAY. It parses and it IS an object, so
    // it reaches the rejection through neither of the arms above, and dropping
    // just that disjunct is neither a crash nor a wording change:
    // `Object.entries(["briber"])` returns `[["0", "briber"]]`, so the file
    // silently becomes a grant map keyed "0" that grants nobody. `briber`
    // imports `listed`, so that edge is then denied with the ORDINARY
    // ungranted-edge message — sending the author to add a grant to a file whose
    // SHAPE is the problem. The edge is what makes the substitution visible; a
    // malformed file nothing imports would report the same either way.
    "FAIL src/features/listed/visibility.json",
    // numbered/visibility.json is the scalar `42` — a generator serialising the
    // wrong variable, or a hand-edit that got as far as a count. It parses, it
    // is not null, it is not an array, and it is the ONLY reachable input that
    // reaches the `typeof parsed !== "object"` disjunct: `nulled` and `listed`
    // each take one of the other two and leave this one deletable with the whole
    // suite green.
    //
    // The deletion is invisible here on purpose. `Object.entries(42)` returns an
    // EMPTY list, so the file becomes a grant map granting nobody and `counter`'s
    // edge is denied at this same path with this same severity — one finding
    // either way. The `messages` entry below is the entire assertion; this line
    // only puts an edge in the tree for the substitution to happen in.
    "FAIL src/features/numbered/visibility.json",
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
    // The pair says a feature the occupancy walker cannot see is denied and
    // clearable, end to end. The narrower claim it was written for — that a
    // deny for an importee outside the enumeration can be cleared at all — moved
    // to `granted-escaping-link` below when the enumeration stopped being a
    // `.ts` glob. Three importees are outside it now, all of them links, and
    // that one is the only one that proves the CLEARING.
    "src/features/remote/visibility.json",
    // The cleared half of the symlink pair, and the step `aliased-target` above
    // stops short of. renderer imports `granted-target` through `granted-link`
    // and the grant is written in the real directory — so this asserts that
    // doing what the failure message SAYS actually works.
    //
    // Without it, a check that treats the two names as two features still passes
    // every denial here, and then audits one physical file twice: the grant
    // clears the error and reads as stale under the other name, so the author is
    // told to drop the entry they just wrote, and dropping it brings the error
    // back. An unclearable finding is invisible to every fixture that only ever
    // checks the denial — which is what this legal neighbour exists to say.
    "src/features/granted-target/visibility.json",
    // The cleared half of the ESCAPING-symlink pair, and the step
    // `escaping-link` stops short of. hoister imports `granted-escaping-link`,
    // whose target sits outside the source root, and the grant is written in
    // that target — reached, and reachable, only through the link name the
    // denial's message prints.
    //
    // Without it, a check that denies an escaping importee without reading a
    // grant file at it passes the denial and is unclearable: the author writes
    // exactly the grant the message asks for and nothing changes. That is
    // invisible to every fixture that only ever checks the denial, and the
    // existence assertion on this path is also what keeps the vendored target
    // and its link in the tree.
    "src/features/granted-escaping-link/visibility.json",
    // The cycle cluster, granted in every direction. `graph/feature-deps` fails
    // on these features and this check must not — the two questions are
    // independent, and a grant is a complete answer to exactly one of them.
    "src/features/cycle-a/visibility.json",
    "src/features/ring-one/visibility.json",
    "src/features/leaf/visibility.json",
    // An importer that is NOT a feature: `src/routes/feature-barrel-neighbour.ts`
    // reads leaf-two's barrel. A grant is a feature's answer about another
    // feature, and a route has no visibility.json to be named in — so this edge
    // needs no entry anywhere, and the guard on the importing end is what says
    // so. Every other edge into a feature in this tree starts INSIDE a feature —
    // the same one, dropped by the importer/importee comparison, or another one,
    // which needs a grant — so all of them pass with that half deleted. This is
    // the only edge that separates the two, and the finding it would produce
    // reads "undefined imports leaf-two".
    "src/features/leaf-two/visibility.json",
    // The route itself, which this check can never file against: the address of
    // a visibility finding is always an importEE's grant file. It is listed for
    // the OTHER half of the legal contract — the runner asserts each path exists,
    // and leaf-two/visibility.json exists for reasons of its own. Without this
    // line, deleting the route file leaves the suite green and puts the guard
    // straight back to being deletable, which is the state this pair of entries
    // was written to end. leaf-two/visibility.json cannot carry that weight on
    // its own: it exists because leaf-two grants hub, and hub's import is
    // untouched by this fixture, so its presence says nothing about whether the
    // route file is still there.
    "src/routes/feature-barrel-neighbour.ts",
  ],

  // The branches whose only distinguishing output is their wording. Every path
  // assertion above is satisfied by a check that reports the right number of
  // findings at the right addresses saying the wrong thing.
  messages: [
    // The deny message names the importing FILES. Replace that list with "" and
    // every path, severity and count assertion in this file still passes — the
    // finding is filed against the importee's visibility.json, so nothing else in
    // the suite ever mentions the importer's side. It is the actionable half for
    // whoever has to remove or justify the import, and the doc's example output
    // shows it, so it is a documented behaviour with no witness otherwise.
    { path: "src/features/closed/visibility.json", contains: "src/features/trespasser/service/sneaks.ts" },
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
    // The escaped feature's unreadable file, which the enumeration cannot see.
    // Path and severity here are exactly the denial `escaping-link` produces one
    // link over, so nothing but the wording says which of the two things went
    // wrong — and a check that reported the parse failure at the enumerated
    // address, or reported it as an ungranted edge, satisfies every count in
    // this file.
    { path: "src/features/unreadable-escaping-link/visibility.json", contains: "is unreadable" },
    // ...and the denial stays suppressed, as it is for `broken`. Adding a grant
    // to a file that does not parse changes nothing, so a message asking for one
    // sends the reader to an edit that cannot work.
    { path: "src/features/unreadable-escaping-link/visibility.json", absent: "has not granted it" },
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
    // ...and `numbered` is the third. Unlike the other two this one has NO other
    // symptom: drop the disjunct it takes and the finding stays at this path,
    // this severity, this count, and starts telling the author to add a grant to
    // a file that cannot hold one. This line is the only thing in the suite that
    // fails when that happens.
    { path: "src/features/numbered/visibility.json", contains: "must be a JSON object" },
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
