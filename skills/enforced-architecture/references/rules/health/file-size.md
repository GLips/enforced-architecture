# health/file-size

| Field | Value |
|---|---|
| **Tag** | health |
| **Mechanism** | Structural script (cross-file, pre-commit + CI) |
| **Blocking** | Mixed (warn and fail thresholds — see Configuration) |

## What it prevents

Files growing beyond a maintainable size. Large files are difficult to reason about, slow to review, and tend to accumulate unrelated responsibilities. Without a mechanical limit, files grow silently — each addition is "just a few lines" until the file is 1200 lines and no one wants to touch it.

This is the simplest structural check but one of the most impactful.

## Where it applies

All `src/**/*.ts` and `src/**/*.tsx` files, excluding:
- Test files (`*.test.*`, `*.integration.test.*`, `__tests__/**`)
- Generated files (`*.gen.*`)
- Script files (`scripts/`)
- Test utilities (`src/test/**`)

## Algorithm

Simple line counting with two thresholds.

1. **Find target files** — Walk `src/` recursively, collect `.ts` and `.tsx` files. Apply exclusion patterns to skip tests, generated files, and scripts.
2. **Check exclusion list** — Skip files that appear in the known-oversized exclusion list (see Configuration).
3. **Count lines** — Count total lines per file (including blanks and comments — the goal is overall file size, not logical complexity).
4. **Compare against thresholds** — If the count exceeds the fail threshold, emit a FAIL. If it exceeds the warn threshold, emit a WARN.

### Why total lines, not logical lines

Counting all lines (blanks, comments, code) is intentional. A file with 300 lines of code and 300 lines of comments is still a 600-line file that is hard to navigate. Logical-line counting adds complexity without meaningfully changing which files get flagged — a file that is large by total lines is almost always large by logical lines too.

## Configuration

```typescript
// Thresholds — calibrate to your project. Start strict, relax only with justification.
const WARN_THRESHOLD = 500;
const FAIL_THRESHOLD = 600;

// Known-oversized files — centralized exclusion list.
// Each entry MUST have a TODO comment explaining the remediation plan.
const EXCLUSIONS: string[] = [
  // "src/features/editor/ui/canvas/renderer.tsx",   // TODO: split into layer renderers
  // "src/features/admin/ui/dashboard/screen.tsx",    // TODO: extract panel components
];
```

**Adjustments:**
- **Thresholds are project-specific.** The defaults above are a reasonable starting point — adjust based on your codebase's natural file sizes. The warn threshold signals "refactor soon"; the fail threshold is a hard stop. The gap between them should give enough room to finish a change and split in the same commit.
- The exclusion list is an escape hatch, not a permanent pass. Every entry must have a `TODO` comment describing the plan to bring the file under the limit. Review the list periodically and remove entries as files are split.
- Never exclude entire directories. If a directory consistently produces large files, the architecture needs rethinking, not broader exclusions.

## Implementation

Bun TypeScript script, delegated from the structural check orchestrator. Can also be implemented as a shell function inside a shell orchestrator — the logic is simple enough for either.

Key implementation details:
- **File discovery** uses glob patterns to collect `.ts`/`.tsx` files, applying exclusions for tests, generated files, and scripts at the discovery stage.
- **Line counting** counts total lines per file. No parsing needed — this is a raw size check.
- **Exclusion list matching** uses path suffix matching so entries work regardless of the working directory prefix.
- **Exit code semantics** — any FAIL means non-zero exit (blocks commit). WARN-only means zero exit (printed to stderr for visibility).

## Example output

```
FAIL: file-size — src/features/editor/ui/canvas/renderer.tsx is 647 lines (limit: 600).
  Split this file before committing. Identify cohesive groups of functions or
  components that can move to sibling modules in the same directory.
  If the file cannot be split yet, add it to the exclusion list in
  scripts/check-file-size.ts with a TODO explaining the remediation plan.

WARN: file-size — src/features/billing/service/subscriptions.ts is 523 lines (warn: 500, limit: 600).
  This file is approaching the hard limit. Consider splitting proactively.
  Common strategies: extract helper functions to a sibling module, split a
  large component into subcomponents, or move substantial type definitions to
  a dedicated types file.
```

## Why mixed blocking

The two-tier approach balances early feedback with hard enforcement:

- **Warn threshold** gives the agent (or developer) a signal that the file is growing. This is the "refactor soon" signal — surface the trend before it becomes a problem.
- **Fail threshold** is the hard stop. The gap between warn and fail provides room to finish a change and split in the same commit, rather than being forced to split mid-thought.

Pure blocking (single threshold) is too aggressive — it interrupts flow for files that are large but stable. Pure non-blocking is too permissive — agents treat warnings as informational and files continue to grow. The mixed approach applies pressure at the right moments.
