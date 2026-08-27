import type { CheckFixtures } from "../../expectations.ts";

export const docBudgetsFixtures: CheckFixtures = {
  check: "health/doc-budgets",

  // Filed against the doc, because that is where condensing happens. The one
  // exception is the unusable ceiling below, which is filed against the manifest.
  obvious: [
    // 175 words against a 160-word ceiling.
    "FAIL docs/over-budget.md",
  ],

  adversarial: [
    // The ratchet, one word past the line: 69 words carrying a 110-word ceiling,
    // where 109 — the count plus the 40-word floor — is the most the deadband
    // allows. Every implementation of the over-budget half passes this file, since
    // it sits comfortably under its ceiling, so this entry is the only thing
    // standing between the gate and a manifest whose slack grows every time a doc
    // shrinks. A wider floor, or a `>=` where a `>` belongs, misses it and nothing
    // else here notices.
    //
    // Which ARM of the deadband binds is not fixtured. The floor governs anything
    // under 800 words and every doc in this tree is far below that, so proving the
    // 5% arm needs an 800-word fixture that exists only to be long.
    // `doc-budgets.test.ts` pins both arms and the crossover on `maxCeiling`
    // directly, which is exact where a fixture would be approximate.
    "FAIL docs/stale-ceiling.md",
    // 68 words by `wc -w`, 45 by splitting on the space character alone: the
    // file is tab- and newline-separated. Its 46-word ceiling sits between the
    // two, and — deliberately — inside the deadband of the naive count, so a
    // counter that misses tabs and newlines reports nothing at all rather than
    // firing for the wrong reason and looking correct.
    "FAIL docs/multiline-tokens.md",
    // Budgeted, and not in the tree. A ceiling over a doc that was renamed or
    // deleted reads as coverage while counting nothing, and skipping the entry
    // — the natural way to keep a file walk from throwing — is what makes a
    // deleted doc the quietest way to get out from under a budget.
    "FAIL docs/renamed.md",
    // `"600"` — a quoted number, the typo JSON invites. Filed against the
    // manifest, since the doc it names is fine. `68 > "600"` is false in
    // JavaScript, so an implementation that skips the type check passes this
    // entry in silence and would pass it at any size.
    "FAIL docs/doc-budgets.manifest.json",
  ],

  legal: [
    // 68 words under a 108-word ceiling: exactly `words + 40`, the largest ceiling
    // the deadband permits at this length. The boundary case on the allowed side,
    // and what pins the threshold where the header says it is — a check that is
    // off by one here reports this file and teaches everyone that trimming a
    // sentence breaks the build.
    "docs/within-budget.md",
    // Longer than anything budgeted, and named nowhere in the manifest. The
    // manifest is the subject, not the `docs/` directory.
    "docs/unbudgeted.md",
  ],
};
