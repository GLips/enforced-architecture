import type { CheckFixtures } from "../../expectations.ts";

export const barrelDiscoverabilityFixtures: CheckFixtures = {
  check: "naming/barrel-discoverability",

  obvious: [
    // A plain `export *`, alone in its own barrel. Alone is the point: the
    // runner compares each kind against the whole reported list, so a path named
    // in both kinds satisfies both from the same findings and the count below
    // stops asserting anything. One kind per path is what makes the multiset
    // catch a dropped branch.
    "FAIL src/features/gateway/index.ts",
    // The same statement in an `index.mts`. A barrel's name is `index`; the
    // extension is not part of it, and a walk that spells one extension governs
    // one eighth of the barrels this tier can see.
    "FAIL src/features/portal/index.mts",
  ],

  // Six shapes over two barrels, and within each barrel the count is the entire
  // assertion: every shape reports on a path some other shape already reports,
  // so losing a branch subtracts a finding rather than a path.
  adversarial: [
    // `export * from "…"`, here as the regression guard rather than the case
    // under test — the three below share this file, and a check that stopped
    // reporting the shape everyone gets right would otherwise still pass.
    "FAIL src/features/surface/index.ts",
    // `export * as surfaceClient from "…"`. A namespace re-export hides the same
    // names, and a pattern anchored on `* from` never sees it.
    "FAIL src/features/surface/index.ts",
    // `export { createClient as createSurfaceClient } from "…"`. A different
    // statement shape from the wildcards, so it needs its own branch — and the
    // branch has to compare the two names rather than match on `as`.
    "FAIL src/features/surface/index.ts",
    // `export type { RegistryEntry as SurfaceRegistryEntry } from "…"`, under
    // the default `flagTypeAliases: true`. The only fixture in the tree that
    // reaches the type branch at all.
    "FAIL src/features/surface/index.ts",
    // `export * from "./service/kiosk-registry.ts"`. The specifier's bytes
    // and the module it names are different strings, so the finding can only
    // quote a path the reader can open if it comes off the parser. Verdict is
    // the same either way — the `messages` entries below are what pin it.
    "FAIL src/features/kiosk/index.ts",
    // `export { "kiosk-open" as openKiosk } from "…"`. A re-exported name
    // written as a string literal. No identifier pattern matches it, and the
    // finding it should have produced simply never appears.
    "FAIL src/features/kiosk/index.ts",
  ],

  legal: [
    // The conforming barrel: names written out, one alias whose two sides are
    // identical, a wildcard sitting in a comment, and a rename sitting in a
    // string. It is the only thing that can catch a check that skips the
    // comparison, or that reads the source text instead of the export record.
    "src/features/surface/index.server.ts",
    // The same wildcard statement inside the feature rather than at its surface.
    // Nothing but the barrel globs keeps this quiet.
    "src/features/surface/service/surface-internals.ts",
    // A module that offers one of its own names as a string. Not a barrel, so
    // it is not this check's subject — and it is what the kiosk barrel renames,
    // which is the case the barrel could not otherwise be written.
    "src/features/kiosk/service/kiosk-session.ts",
  ],

  // The verdict cannot separate a specifier read from the parser from one
  // scraped out of the quotes: the same line reports either way. Only the
  // wording says which reading produced it. Same for the type-only note, which
  // is a whole branch that changes no verdict — deleting it left every count in
  // this file right.
  messages: [
    {
      // Which wildcard. The namespace clause is quoted back, because "a
      // wildcard is here" sends the reader to a line with four statements on
      // the ones above it — and dropping the clause changes no count, since the
      // finding fires on this path either way.
      path: "src/features/surface/index.ts",
      contains: 'export * as surfaceClient from "./service/surface-client.ts"',
    },
    {
      // The narrow half: the gateway barrel's wildcard has no namespace, so a
      // message that always writes one is quoting a statement nobody wrote.
      path: "src/features/gateway/index.ts",
      absent: "export * as",
    },
    {
      // The type-only rename's own paragraph. The three other findings on this
      // path are value renames and a wildcard, so a check that lost this branch
      // still reports four times here and only the wording tells.
      path: "src/features/surface/index.ts",
      contains: "This one is type-only.",
    },
    {
      // The narrow half: the kiosk barrel has a value rename and a wildcard and
      // nothing type-only, so the note must appear on neither. A paragraph
      // written for one reader and delivered to all of them passes every
      // `contains` there is.
      path: "src/features/kiosk/index.ts",
      absent: "This one is type-only.",
    },
    {
      // The module's NAME. A reader handed the other string greps for a file
      // that is not there and concludes the check is stale.
      path: "src/features/kiosk/index.ts",
      contains: 'export * from "./service/kiosk-registry.ts"',
    },
    {
      // The load-bearing half: the escape as the bytes spell it must appear in
      // NO finding on this path. A check that quotes the source text passes the
      // `contains` above only by accident and fails here.
      path: "src/features/kiosk/index.ts",
      absent: "kiosk-registr\\u0079",
    },
    {
      // The string-named re-export, named in the message so the second finding
      // on this path is pinned to its own branch rather than to the count.
      path: "src/features/kiosk/index.ts",
      contains: "export { kiosk-open as openKiosk }",
    },
  ],
};
