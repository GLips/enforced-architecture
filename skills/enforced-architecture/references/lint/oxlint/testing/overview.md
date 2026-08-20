# testing — Test design

**Note the inverted file scope.** Every other oxlint rule in this catalog skips test files; this one must not, or it matches nothing. Adopting it in a suite that already leans on module mocks is a refactor — run it as a warning first.

| Rule | Blocking | What it buys |
|---|---|---|
| [no-module-mocking](no-module-mocking.ts) | Yes | Every test runs the real module that it names, so a change to that module fails the tests that cover it |

Adoption mechanics, the spec contract, and cross-tag rule selection: [../../overview.md](../../overview.md).
