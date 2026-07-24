# naming/test-file-mirror

| Field | Value |
|---|---|
| **Tag** | naming |
| **Mechanism** | Structural script (cross-file, pre-commit + CI) |
| **Blocking** | No (warn) |

## What it prevents

Test files whose names don't map to the source they cover — `billing.spec.ts` next to `invoices.ts`, or `test_email.ts` covering `mailer.ts`. When a test file mirrors its source (`invoices.ts` → `invoices.test.ts`), a single search for the concept surfaces both the code and its tests together, and an agent about to change `invoices.ts` immediately sees the test that constrains it. When the names diverge, the test is invisible to that search — the agent edits the source, never finds the test, and either breaks it silently or fails to update it.

This rule enforces one convention: every test file is named `<source>.test.ts(x)` and sits beside a real source file of that base name.

## Where it applies

Co-located test files under `src/**` (this architecture places tests beside the code they cover). It checks the *test* side of the pairing:
- Every `*.test.ts` / `*.test.tsx` / `*.integration.test.ts(x)` must have a sibling source file with the same base name (`invoices.test.ts` → `invoices.ts` or `invoices.tsx` in the same directory).

It does NOT require that every source file have a test — tests must earn their place, and many files correctly have none. The rule is about *naming the tests that exist* so they're discoverable, not about coverage.

## Algorithm

1. **Find test files** — glob `src/**/*.test.{ts,tsx}` and the `.integration.test` variant.
2. **Derive the expected source base** — strip the `.test` / `.integration.test` segment: `invoices.test.ts` → base `invoices`.
3. **Check for a sibling source** — in the same directory, look for `<base>.ts` or `<base>.tsx`. If none exists, WARN: the test name doesn't correspond to a source file, so it won't surface alongside one.
4. **Flag non-conforming test names** — also glob for common off-convention test names (`*.spec.ts`, `test_*.ts`, `__tests__/*` if the project chose co-location) and WARN with the canonical rename.

## Configuration

```typescript
// The blessed test suffixes. Adapt if your project standardizes differently
// (e.g., some projects prefer `.spec.` — pick ONE and enforce it).
const TEST_SUFFIXES = [".test.ts", ".test.tsx", ".integration.test.ts", ".integration.test.tsx"];

// Off-convention patterns to actively flag toward the canonical suffix.
const NONCONFORMING = [/\.spec\.[tj]sx?$/, /(^|\/)test_[^/]+\.[tj]sx?$/];

// Directories where an orphan test (no matching source) is legitimate —
// cross-cutting integration suites that don't map 1:1 to a source file.
const ORPHAN_ALLOWED_DIRS: string[] = [
  // "src/test/integration",
];
```

## Example output

```
WARN: test-file-mirror — src/features/billing/invoices.spec.ts
  Test file uses `.spec.` — the project convention is `<source>.test.ts`.
  Rename to `invoices.test.ts` so it surfaces in the same search as `invoices.ts`.

WARN: test-file-mirror — src/features/billing/edge-cases.test.ts
  No source file `edge-cases.ts`/`edge-cases.tsx` sits beside this test, so the
  test won't surface alongside the code it covers. Rename the test to match the
  source it exercises, or move it to a configured integration directory.
```

## Why warn, not block

Naming drift in tests hurts discoverability, not correctness — the tests still run. Blocking would also snag legitimate cross-cutting integration suites that don't map to a single source file (handled by `ORPHAN_ALLOWED_DIRS`, but the boundary is fuzzy). A warning steers new tests toward the mirror convention without stopping a commit; if a project's test layout is fully co-located and disciplined, promote it to blocking.
