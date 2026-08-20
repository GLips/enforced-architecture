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
  ],

  // Four shapes on four lines of ONE barrel, so the count is the entire
  // assertion: lose any single branch and three of these four go unmatched.
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
  ],

  legal: [
    // The conforming barrel: names written out, one alias whose two sides are
    // identical, and a wildcard sitting in a comment. It is the only thing that
    // can catch a matcher that skips the comparison or skips the blanking.
    "src/features/surface/index.server.ts",
    // The same wildcard statement inside the feature rather than at its surface.
    // Nothing but the barrel globs keeps this quiet.
    "src/features/surface/service/surface-internals.ts",
  ],
};
