# health — Code quality metrics

The whole-tree half. Set thresholds from the codebase, not the defaults. One that fires on a third
of the repo on day one teaches everyone the linter cries wolf, which costs you the boundary rules
too. The per-file half is in [../../oxlint/health/overview.md](../../oxlint/health/overview.md).

| Rule | Blocking | What it prevents |
|---|---|---|
| [doc-budgets](doc-budgets.md) | Yes | Standing docs growing past a word ceiling, and ceilings keeping slack a shrunken doc no longer needs |
| [file-size](file-size.md) | Mixed | Files exceeding line count thresholds (project-configurable warn + fail) |
| [trampolines](trampolines.md) | No | Pass-through wrapper functions that add no behavior |

Adoption mechanics, the spec contract, and cross-tag rule selection: [../../overview.md](../../overview.md).
