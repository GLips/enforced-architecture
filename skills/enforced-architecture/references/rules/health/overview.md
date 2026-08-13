# health — Code quality metrics

Set thresholds from the codebase, not the defaults. One that fires on a third of the repo on day one teaches everyone the linter cries wolf, which costs you the boundary rules too.

| Rule | Mechanism | Blocking | What it prevents |
|---|---|---|---|
| [file-size](file-size.md) | Script | Mixed | Files exceeding line count thresholds (project-configurable warn + fail) |
| [no-nested-ternary](no-nested-ternary.ts) | oxlint | Yes | Ternary expressions nested 3+ levels deep (extract to variables or helpers) |
| [trampolines](trampolines.md) | Script | No | Pass-through wrapper functions that add no behavior |

Adoption mechanics, the spec contract, and cross-tag rule selection: [../overview.md](../overview.md).
