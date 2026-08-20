import type { CheckFixtures } from "../../expectations.ts";

export const topologyFixtures: CheckFixtures = {
  check: "placement/topology",

  // A new top-level directory that is not a layer. Governed by nothing, and
  // visible as such the moment you look at the path.
  obvious: ["FAIL src/lib/format-date.ts"],

  adversarial: [
    // The same "governed by nothing" from INSIDE a governed directory. The
    // first path segment is `features`, so a top-level-only whitelist passes
    // it; the layer rules scope to `features/<name>/<layer>/` and never reach
    // it either. This is the case the check's own doc names, and the one a
    // first-segment implementation misses while looking correct.
    "FAIL src/features/scanner/helpers.ts",
    // A file directly in the subdivided directory, owned by no boundary at all.
    // An implementation that starts matching at `features/<name>/<layer>` binds
    // `orphan-module.ts` to <name> and then finds no layer, so it either reports
    // the wrong thing or — if it requires a layer to exist before it looks —
    // nothing. Position 3 of the grammar, and the easiest one to leave out.
    "FAIL src/features/orphan-module.ts",
  ],

  // These carry more weight than the violations. This rule's failure mode is
  // over-matching on architecture the project's own documentation recommends,
  // and a file the architecture recommends and this rule rejects is the failure
  // that gets the whole check disabled rather than fixed.
  legal: [
    // A source-root file. Not a layer, has no layer to move to, and rejected by
    // a whitelist of directory names alone.
    "src/env.server.ts",
    // A feature's error types and its barrel, at the same address as
    // `helpers.ts` next door. Closing feature roots by forbidding files there
    // takes both of these with it — including the barrel every consumer of the
    // feature is required to import through.
    "src/features/scanner/errors.ts",
    "src/features/scanner/index.ts",
    // An internal module at a DOMAIN root — the layout `directory-model.md`
    // recommends, and the shape the feature grammar rejects when it is applied
    // to every subdivided directory alike. Two independent implementers hit
    // this and both moved their fixtures to work around it, which is the
    // workaround a real project performs by switching the check off.
    "src/domains/ledger/posting-rules.ts",
  ],
};
