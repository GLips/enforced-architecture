# health/doc-budgets

| Field | Value |
|---|---|
| **Tag** | health |
| **Mechanism** | Structural check — [doc-budgets.ts](doc-budgets.ts) |
| **Blocking** | Yes |

## What it prevents

Standing documentation growing without bound. Every doc a project asks agents to read is a doc agents keep appending to: a clarifying paragraph, a worked example, a note about the case that just came up. Each addition is defensible on its own and none is ever removed, so the file that was written to be read on every task becomes the file that is skimmed and then skipped.

The failure is not that the docs are wrong. It is that a doc past its useful length stops being read, and nothing tells you when it crossed over — which is the same shape as every other silence in this catalog.

A ceiling turns the decision into a trade. Under a budget, adding a paragraph means cutting one, moving the material to the doc that owns it, or raising the number where a human sees it.

## The ratchet

The ceiling is only half. A doc that gets condensed leaves its old ceiling behind, and that slack is room the next agent expands into with no diff anyone reads — the budget goes on passing while the doc grows back.

So the check fails a ceiling that sits more than **5%** above the doc's actual size, and a ceiling therefore only ever moves down by itself. Reclaiming the slack happens in the same change that created it, when the person who shortened the doc is the one who knows the new number. The allowed maximum is `ceil(words × 1.05)`, so a 500-word doc may carry 525 and no more.

Raising a ceiling stays possible and stays visible: it is a line in the manifest, in the commit that needed the room, next to the reason. That is the whole enforcement mechanism — nothing here can tell good prose from filler, and nothing tries.

## Where it applies

Exactly the files named in the manifest at `manifestPath`, a flat JSON object of project-relative doc path to integer word ceiling:

```json
{
  "CLAUDE.md": 900,
  "docs/architecture/import-boundaries.md": 620,
  "docs/architecture/feature-patterns.md": 780
}
```

Budget the **standing** docs: CLAUDE.md and the `docs/architecture/` files agents read while deciding where code goes. Those are the ones that grow, and the ones whose length costs something on every task. Plans, ADRs, changelogs, and anything else written once and appended to by design belong outside the manifest.

Counting is `wc -w` equivalent — whitespace-delimited tokens, with tables, code fences, and front matter included. A 40-line table takes a reader's attention like any other 300 words do, and a counter that excludes fenced blocks is one that invites the material to move into fenced blocks.

## Adapt

The only knob is `config.checks["health/doc-budgets"].manifestPath`, defaulting to `docs/doc-budgets.manifest.json`. The budgets themselves live in that file rather than in the architecture config, so raising one reads as a documentation decision in the diff that needed it.

**Set the first ceilings from what the docs already weigh**, not from an ideal:

```
bun lint/structural/health/doc-budgets.ts --list docs/doc-budgets.manifest.json
```

`--list` prints `usage / ceiling` per entry and decides nothing — no findings, no exit code, run from the project root. Start each ceiling at the current count, and the ratchet takes it from there. Starting from a number the docs do not meet yet means the check fails on day one, which is how a gate gets switched off. An example manifest ships at [../../setup/doc-budgets.manifest.json](../../../setup/doc-budgets.manifest.json).

**The 5% headroom is not configurable.** It is the ratchet's tightness, and a project that can tune it tunes it upward on the first commit it inconveniences.

## Negative space

- **It does not discover docs.** A markdown file nobody listed is a file this check has nothing to say about. Budgeting every `.md` in the repo means budgeting generated output and one-shot plans, and the noise is what makes a list stop being read. The cost of the choice is real: adding a doc means adding an entry, and forgetting to is invisible here.
- **It has no opinion about content.** Word count is a proxy, and a bad one for quality. It is a good one for whether the doc still fits in the attention it is given.
- **No per-file override.** A pragma inside the doc puts the decision where the pressure is. The manifest is central so the whole budget is readable at once, and so raising one is a diff in the file that exists to be reviewed.
- **A missing or unparseable manifest is an error**, not an empty run. A typo in `manifestPath` otherwise leaves every doc uncounted while the check reports clean. That branch is the one thing here the fixture tree cannot exercise — it holds exactly one manifest, and every other case needs it to parse.
- **An empty manifest is not an error.** Zero entries is a project that has not adopted budgets, and the tier's answer for an unadopted check is to drop its registration rather than to keep a check that governs nothing.

## Example output

```
FAIL [health/doc-budgets] docs/architecture/feature-patterns.md
  843 words against a 780-word ceiling.
  Condense, or move the material to the doc that owns it. Raising the ceiling
  in docs/doc-budgets.manifest.json is the other option, and it is a diff
  someone has to approve with a reason.

FAIL [health/doc-budgets] docs/architecture/import-boundaries.md
  402 words against a 620-word ceiling: more than 5% slack.
  The doc shrank and its ceiling did not. Lower it to 423 or below in
  this same change — unclaimed slack is room the next agent expands into with
  no diff anyone reads.
```
