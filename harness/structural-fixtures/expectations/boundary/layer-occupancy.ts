import type { CheckFixtures } from "../../expectations.ts";

export const layerOccupancyFixtures: CheckFixtures = {
  check: "boundary/layer-occupancy",

  obvious: [
    // A controller building its own query from the schema while
    // `features/billing/repo/` exists. The doc's own headline case.
    "FAIL src/features/billing/controllers/invoices.ts",
  ],

  // Both are the repo bypass written the way a specifier matcher loses it, and
  // between them they cover the two spellings the same import takes in one repo.
  adversarial: [
    // `../../repo/x` from a nested controller. A grep for `../repo/` reads it as
    // clean, and the extra segment is what the import looks like the moment a
    // controllers/ directory grows a subfolder.
    "FAIL src/features/billing/controllers/nested/jobs.ts",
    // `@/features/billing/repo/x` — the same-feature alias, which contains no
    // `../` for a relative matcher to key on and is what auto-import writes.
    "FAIL src/features/billing/controllers/aliased.ts",
  ],

  legal: [
    // The DB client from a controller while repo/ exists. Allowed, so the
    // controller can open a transaction and pass the connection down — and the
    // first thing an over-broad "controllers must not import db" version breaks.
    "src/features/billing/controllers/transactional.ts",
    // A type-only import of the very repo module the adversarial cases are
    // reported for. The graph hands this edge over, so it has to be dropped
    // deliberately rather than never arriving.
    "src/features/billing/controllers/typed-repo-neighbour.ts",
    // The same schema import that fires from billing, in a feature with neither
    // repo/ nor service/. Presence is what activates the check; without the
    // presence test this file reports and every young feature needs three
    // directories before it can touch a database.
    "src/features/thin/controllers/reports.ts",
  ],
};
