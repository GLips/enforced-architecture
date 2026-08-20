# testing — Test design

**Note the inverted file scope.** Every other oxlint rule in this catalog skips test files; this one must not, or it matches nothing. Adopting it in a suite that already leans on module mocks is a refactor — run it as a warning first.

| Rule | Blocking | What it prevents |
|---|---|---|
| [no-module-mocking](no-module-mocking.ts) | Yes | `vi.mock` / `jest.mock` — tests coupled to import paths that keep passing when the real module changes |

Adoption mechanics, the spec contract, and cross-tag rule selection: [../../overview.md](../../overview.md).
