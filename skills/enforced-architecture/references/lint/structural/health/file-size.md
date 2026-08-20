# health/file-size

| Field | Value |
|---|---|
| **Tag** | health |
| **Mechanism** | Structural check — [file-size.ts](file-size.ts) |
| **Blocking** | Mixed (over `failThreshold` fails, over `warnThreshold` warns) |

## What it prevents

Files growing beyond a maintainable size. Large files are difficult to reason about, slow to review, and tend to accumulate unrelated responsibilities. Without a mechanical limit, files grow silently — each addition is "just a few lines" until the file is 1200 lines and no one wants to touch it.

This is the simplest structural check but one of the most impactful.

## Where it applies

Every `.ts` and `.tsx` file under the configured `roots`, minus the tier's global exclusions — tests, generated output, declaration files, and the check tooling itself. Those live in `config.source.exclude` and are stated once so no rule can govern a slightly different set than its neighbour.

### Why total lines, not logical lines

Counting all lines — blanks, comments, code — is intentional. A file with 300 lines of code and 300 lines of comments is still a 600-line file that is hard to navigate. Logical-line counting adds complexity without meaningfully changing which files get flagged: a file that is large by total lines is almost always large by logical lines too.

## Adapt

Knobs live in `config.checks["health/file-size"]`: `roots`, `warnThreshold`, `failThreshold`, `exclusions`.

**`roots` is often wider than `source.roots`.** This is the one check whose subject is not architectural — a 900-line file in a sibling package is exactly as hard to review as one in `src/`, and the boundary rules have no opinion about it. Name every root worth measuring.

**Thresholds are project-specific.** The defaults are a starting point; calibrate to the codebase's natural file sizes. The warn threshold signals "refactor soon", the fail threshold is a hard stop, and the gap between them should give enough room to finish a change and split it in the same commit.

**`exclusions` is an escape hatch, not a permanent pass.** Entries match by path suffix, so they work regardless of the working-directory prefix. Every entry carries a `TODO` naming how the file gets back under the limit, and the list gets reviewed rather than accumulated.

## Negative space

- **Never exclude a whole directory.** If a directory consistently produces large files, the architecture needs rethinking and a broader exclusion hides exactly that signal.
- **It does not parse.** A raw size check has no opinion about what is in the file, which is why it costs nothing to run and why it never disagrees with a rule that does parse.
- **No per-file override comment.** A pragma in the file puts the decision where the pressure is, and the file that most wants an exemption is the one that least deserves one. The exclusion list is central so the set stays readable in one place.

## Example output

```
FAIL [health/file-size] src/features/editor/ui/canvas/renderer.tsx
  647 lines (limit: 600).
  Split this file before committing — move a cohesive group of functions or
  components to a sibling module in the same directory. If it genuinely cannot
  be split yet, add it to the exclusion list in the project's architecture
  config with a TODO naming how it gets back under the limit.

WARN [health/file-size] src/features/billing/service/subscriptions.ts
  523 lines (warn: 500, limit: 600).
  Approaching the hard limit — consider splitting proactively. Extract helper
  functions to a sibling module, split a large component into subcomponents,
  or move substantial type definitions to a dedicated types file.
```

## Why mixed blocking

The two-tier approach balances early feedback with hard enforcement:

- **Warn threshold** gives the agent (or developer) a signal that the file is growing. This is the "refactor soon" signal — surface the trend before it becomes a problem.
- **Fail threshold** is the hard stop. The gap between warn and fail provides room to finish a change and split in the same commit, rather than being forced to split mid-thought.

Pure blocking (single threshold) is too aggressive — it interrupts flow for files that are large but stable. Pure non-blocking is too permissive — agents treat warnings as informational and files continue to grow. The mixed approach applies pressure at the right moments.
