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
    // The ratchet, one word past the line: 69 words carrying a 74-word ceiling,
    // where 73 is the most 5% headroom allows. Every implementation of the
    // over-budget half passes this file — it is comfortably under its ceiling —
    // so this entry is the only thing standing between the gate and a manifest
    // whose slack quietly grows every time a doc shrinks. A 10% headroom, or a
    // `>=` where a `>` belongs, misses it and nothing else here notices.
    "FAIL docs/stale-ceiling.md",
    // 68 words by `wc -w`, 45 by splitting on the space character alone: the
    // file is tab- and newline-separated. Its 46-word ceiling sits between the
    // two, and — deliberately — inside the 5% band of the naive count, so a
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
    // 68 words under a 72-word ceiling: exactly `ceil(words × 1.05)`, the
    // largest ceiling the ratchet permits. The boundary case on the allowed
    // side, and what pins the threshold where the header says it is — a check
    // rounding the other way reports this file and teaches everyone that
    // trimming a sentence breaks the build.
    "docs/within-budget.md",
    // Longer than anything budgeted, and named nowhere in the manifest. The
    // manifest is the subject, not the `docs/` directory.
    "docs/unbudgeted.md",
  ],
};
