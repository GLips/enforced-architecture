import type { CheckFixtures } from "../../expectations.ts";

export const layerOccupancyFixtures: CheckFixtures = {
  check: "boundary/layer-occupancy",

  obvious: [
    // `ui/` reaching straight through to `service/` while `controllers/` is
    // occupied. Nothing about it involves a controller as the IMPORTER, which is
    // exactly the shape a check gated on the source layer cannot see — and it is
    // the commonest bypass there is.
    "FAIL src/features/layers/ui/downward-neighbour.ts",
    // A controller building its own query from the schema while
    // `features/billing/repo/` is occupied. The schema arm's headline case.
    "FAIL src/features/billing/controllers/invoices.ts",
  ],

  adversarial: [
    // `../../repo/x` from a nested controller. A grep for `../repo/` reads it as
    // clean, and the extra segment is what the import looks like the moment a
    // controllers/ directory grows a subfolder.
    "FAIL src/features/billing/controllers/nested/jobs.ts",
    // `@/features/billing/repo/x` — the same-feature alias, which contains no
    // `../` for a relative matcher to key on and is what auto-import writes.
    "FAIL src/features/billing/controllers/aliased.ts",
    // The same bypass written `import type`. It compiles away, so a check
    // protecting runtime behaviour would wave it past — and `import type` would
    // become the supported spelling of the bypass. The verdict must not branch
    // on `typeOnly`; only the wording may, which is what `messages` pins.
    "FAIL src/features/billing/controllers/typed-repo-neighbour.ts",
  ],

  legal: [
    // The DB client from a controller while repo/ exists. Allowed, so the
    // controller can open a transaction and pass the connection down — and the
    // first thing an over-broad "controllers must not import db" version breaks.
    "src/features/billing/controllers/transactional.ts",
    // The same schema import that fires from billing, in a feature with neither
    // repo/ nor service/. Presence is what activates the schema arm; without the
    // presence test this file reports and every young feature needs three
    // directories before it can touch a database.
    "src/features/thin/controllers/reports.ts",
    // A file already IN the data layer importing the schema. That is where query
    // construction belongs, so the arm has to stop at the bottom of the stack
    // rather than reporting the destination it names.
    "src/features/billing/repo/invoice-rows.ts",
    // ui -> service in a feature with NO controllers/ at all. Byte for byte the
    // edge the first obvious case is reported for; only what the feature has on
    // disk separates them. Skipping an absent layer is correct — a feature with
    // no controllers is a feature that did not need one — so this is the case
    // that stops the check reading length as bypass.
    "src/features/alpha/ui/within-feature-neighbour.ts",
    // service -> repo, one rung down and skipping nothing, in the very feature
    // whose controllers are reported for the same target. A check comparing
    // positions with `>=` instead of a strict slice reports it.
    "src/features/billing/service/invoice-summary.ts",
  ],

  messages: [
    // The type-aware sentence exists only to tell a reader the check KNOWS this
    // is a type, without which the finding reads as a false positive. Nothing
    // above can see it: the path and severity are identical with the branch
    // deleted.
    {
      path: "src/features/billing/controllers/typed-repo-neighbour.ts",
      contains: "This import is type-only, which is the same bypass",
    },
    // And it is made ONLY to the reader who wrote one. A blocking message that
    // argues a case the reader is not in is a message they learn to skim, so the
    // runtime bypass right next to it must not carry the same paragraph. This is
    // the assertion that fails when the branch is deleted in the OTHER direction
    // — made unconditional, which every positive case passes.
    {
      path: "src/features/billing/controllers/nested/jobs.ts",
      contains: "Route the call through features/billing/service/ instead",
    },
    {
      path: "src/features/billing/controllers/nested/jobs.ts",
      absent: "This import is type-only",
    },
    // The skipped layer is named from the SLICE, not from a config key. With the
    // layer names hardcoded back in, a ui -> service finding names repo/.
    {
      path: "src/features/layers/ui/downward-neighbour.ts",
      contains: "bypasses controllers/: ui imports",
    },
    // The schema arm's distinction, which is the one the doc says the whole rule
    // turns on: construction moves down, execution does not.
    {
      path: "src/features/billing/controllers/invoices.ts",
      contains: "It is query CONSTRUCTION that has to be concentrated in repo/",
    },
  ],
};
