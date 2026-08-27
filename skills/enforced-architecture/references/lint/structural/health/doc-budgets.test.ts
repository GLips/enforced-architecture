// ─── The deadband's own cases ─────────────────────────────────────────
//
// `maxCeiling` is a clamp, and a fixture tree cannot reach both of its arms. The
// floor governs every doc under 800 words and the fixture docs are all under
// 120, so an implementation that dropped the proportional arm entirely would
// pass every fixture in the tree. The crossover is a property of the number, so
// it is asserted against the function.
//
// `ratchetCeilings` is here for the opposite reason: it never produces a
// finding, so no fixture can observe it at all. What it must not do is the
// interesting half — raise a ceiling, or drop a row it cannot fix.
//
// This ships beside the module for the reason `theme-scale.test.ts` does: a
// project copying `structural/` gets the proof with the code.
// ──────────────────────────────────────────────────────────────────────

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { maxCeiling, ratchetCeilings, type DocBudgetRow } from "./doc-budgets.ts";

// node:test's `describe` and `it` hand back the suite's promise, and the runner
// owns and awaits the suite it created. See `import-scanning.test.ts`.
function describeSuite(name: string, body: () => void): void {
  void describe(name, body);
}

function row(partial: Partial<DocBudgetRow> & Pick<DocBudgetRow, "path">): DocBudgetRow {
  return { ceiling: 100, words: 90, status: "ok", ...partial };
}

describeSuite("maxCeiling", () => {
  void it("gives a short doc the 40-word floor, not 5% of nearly nothing", () => {
    // The case that started this: 5% of 359 is 18 words, so one deleted sentence
    // fails the build. The floor is what makes the deadband usable down here.
    assert.equal(maxCeiling(359), 399);
    assert.equal(maxCeiling(0), 40);
    assert.equal(maxCeiling(1), 41);
  });

  void it("switches to 5% once 5% is the larger, at 800 words", () => {
    // 800 is the crossover exactly: 5% of it IS 40, so both arms agree and the
    // seam is invisible. One word either side is what proves which arm bound.
    assert.equal(maxCeiling(799), 799 + 40);
    assert.equal(maxCeiling(800), 800 + 40);
    assert.equal(maxCeiling(801), 801 + 41);
    assert.equal(maxCeiling(2000), 2100);
  });

  void it("rounds the proportional arm up, never down", () => {
    // A ceiling rounded down is one a doc cannot legally carry, which reports
    // the doc that just shortened itself correctly.
    assert.equal(maxCeiling(1001), 1001 + 51);
  });
});

describeSuite("ratchetCeilings", () => {
  void it("lowers a slack ceiling to the deadband and reports the move", () => {
    const next = ratchetCeilings([row({ path: "a.md", ceiling: 900, words: 359, status: "slack" })]);
    assert.deepEqual(next, { "a.md": 399 });
  });

  void it("returns undefined when nothing is slack, so no file is rewritten", () => {
    // A write on every run is a manifest that churns in every diff, which is the
    // noise this flag exists to avoid producing.
    assert.equal(ratchetCeilings([row({ path: "a.md", status: "ok" })]), undefined);
  });

  void it("never raises a ceiling, whatever the row says", () => {
    // The whole asymmetry. Growth is the direction that has to cost a human a
    // decision, so an `over` row is copied through untouched and left to fail.
    const next = ratchetCeilings([
      row({ path: "over.md", ceiling: 100, words: 400, status: "over" }),
      row({ path: "slack.md", ceiling: 900, words: 359, status: "slack" }),
    ]);
    assert.deepEqual(next, { "over.md": 100, "slack.md": 399 });
  });

  void it("copies through the rows it cannot fix rather than dropping them", () => {
    // Dropping an unusable or orphaned entry would delete a budget silently —
    // worse than the finding it replaces, and invisible in the manifest diff.
    const next = ratchetCeilings([
      row({ path: "bad.md", ceiling: "600", words: 68, status: "invalid" }),
      row({ path: "gone.md", ceiling: 200, words: undefined, status: "missing" }),
      row({ path: "slack.md", ceiling: 900, words: 359, status: "slack" }),
    ]);
    assert.deepEqual(next, { "bad.md": "600", "gone.md": 200, "slack.md": 399 });
  });
});
