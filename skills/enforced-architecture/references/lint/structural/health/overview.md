# health — Code quality metrics

The whole-tree half. Set thresholds from the codebase, not the defaults. One that fires on a third
of the repo on day one teaches everyone the linter cries wolf, which costs you the boundary rules
too. The per-file half is in [../../oxlint/health/overview.md](../../oxlint/health/overview.md).

| Rule | Blocking | What it buys |
|---|---|---|
| [doc-budgets](doc-budgets.ts) | Yes | Every doc in the manifest is at or below its word ceiling, and no ceiling is more than 5% above the count |
| [file-size](file-size.ts) | Mixed | Every `.ts` and `.tsx` file in the configured roots is shorter than `failThreshold` lines |
| [trampolines](trampolines.ts) | No | Each exported function in a target layer whose body has no variable, no branch, and no try or throw |

`doc-budgets` governs only the docs its manifest names. It does not search for markdown files, so a
new doc has no ceiling until a person adds an entry. No other rule closes that hole. Budget the
standing docs: CLAUDE.md and the `docs/architecture/` files that agents read on every task. Plans,
ADRs and changelogs grow by design and belong outside the manifest.

`file-size` is the one health check whose roots are not the source roots. It measures any package
you name, so it reports on code that no boundary rule reads. Leave `roots` at the default, and a
sibling package you believe is covered gets no result.

`trampolines` reports legitimate functions. A call through a telemetry helper, a seam held for a
test fake, and a function that grows in the next commit all look the same to it. It warns, and a
person makes the decision. It reads only `export function` and the methods of an
`export const obj = {…}`. A project that writes its services as exported arrow functions gets no
findings at all. It scans the layers in `targetLayers`, which defaults to the service layer. Never
add the repo layer: a thin wrapper on a query is the job of that layer, so the check then reports
all of it.

Adoption mechanics, the spec contract, and cross-tag rule selection: [../../overview.md](../../overview.md).
