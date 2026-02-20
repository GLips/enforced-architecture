# boundary/layer-occupancy

| Field | Value |
|---|---|
| **Tag** | boundary |
| **Mechanism** | Structural script (cross-file, pre-commit + CI) |
| **Blocking** | Yes |

## What it prevents

Controllers bypassing a present repo/ layer to access the database schema directly. When a feature has a `repo/` directory, all DB query construction must flow through that layer. Controllers may still import the DB client (`infrastructure/db/client`) to pass it to repo functions for transaction handling, but they must not import DB schema modules to build queries themselves.

This is the filesystem-aware complement to the per-file DB isolation rule. The per-file rule (db-isolation) restricts which layers can import DB at all. This structural check adds a conditional tightening: when a feature graduates to having a repo layer, the controller-to-DB shortcut is revoked for schema imports. The invariant is "skip absent layers, never bypass present ones" — and this check enforces the "never bypass" half for the most important layer boundary (data access).

Without this check, a feature could have a well-organized repo/ directory while individual controllers silently build ad-hoc queries against the schema, fragmenting data access logic across two layers.

## Where it applies

`src/features/*/controllers/**/*.ts` — but only for features that have a `src/features/*/repo/` directory. Features without a repo/ directory are not checked (their controllers are the designated DB access layer).

## Algorithm

Filesystem-aware, not AST-based. Checks directory presence then scans for import patterns.

1. **Enumerate features** — Walk `src/features/*/` directories.
2. **Check for repo layer** — For each feature, test if `src/features/<name>/repo/` exists. If not, skip the feature entirely.
3. **Scan controllers** — For each feature with a repo/ layer, find all `.ts`/`.tsx` files in `controllers/` (excluding tests).
4. **Check for schema imports** — Grep each controller file for imports matching `@/infrastructure/db/schema`. This is the pattern that indicates direct query construction.
5. **Exclude type-only imports** — Filter out `import type` statements, which do not create runtime dependencies. Type imports from schema are allowed because they convey no query construction capability.
6. **Report** — Emit the feature name, file path, and a fix instruction for each violation.

### Why schema but not client?

The DB client import (`@/infrastructure/db/client`) is allowed from controllers even when repo/ exists. Controllers pass the `db` instance to repo functions to enable transaction handling (wrapping multiple repo calls in a single transaction). The client import conveys execution capability; the schema import conveys query construction capability. Only query construction must be concentrated in repo/.

## Configuration

```typescript
// The import pattern that indicates direct DB query construction
const SCHEMA_IMPORT_PATTERN = /from ['"]@\/infrastructure\/db\/schema/;

// Pattern that indicates a type-only import (excluded from violations)
const TYPE_ONLY_IMPORT = /^import type /;

// Feature layers to scan for violations
const SOURCE_LAYER = "controllers";

// Feature layer whose presence triggers the check
const GATING_LAYER = "repo";
```

**Adjustments:**
- If your DB schema lives elsewhere (e.g., `@/db/schema`), update `SCHEMA_IMPORT_PATTERN`.
- If your project uses a different name for the data access layer (e.g., `data/`, `queries/`), update `GATING_LAYER`.
- If your project has a service layer that should also be gated (controllers cannot bypass service when it exists), add a second pass with `SOURCE_LAYER = "controllers"` and `GATING_LAYER = "service"`.

## Implementation

Bun TypeScript script, delegated from the structural check orchestrator. Can also be implemented as a shell function — the logic is simple enough for either.

Key implementation details:
- **Feature enumeration** uses directory listing, not glob, to avoid expanding into subdirectories.
- **Repo existence check** is a simple directory test (`[ -d "$feature_dir/repo" ]`).
- **Import scanning** uses `grep` for speed. Full AST parsing is unnecessary — the import pattern `from "@/infrastructure/db/schema` is unambiguous.
- **Type-only filtering** greps the matching lines for `^import type` and excludes them. This prevents false positives from type imports used for parameter type annotations.
- **Exit code** contributes to the overall structural check pass/fail. Each violation increments the error counter.

## Example output

```
FAIL [layer-occupancy] src/features/billing/controllers/invoices.ts
  Controller imports DB schema directly, but feature "billing" has a repo/ layer.
  Move the query to a function in src/features/billing/repo/ and import that
  instead. Controllers may import the DB client for transaction handling, but
  schema imports (query construction) must flow through repo/.

FAIL [layer-occupancy] src/features/chat/controllers/conversations.ts
  Controller imports DB schema directly, but feature "chat" has a repo/ layer.
  Move the query to a function in src/features/chat/repo/ and import that
  instead. Controllers may import the DB client for transaction handling, but
  schema imports (query construction) must flow through repo/.
```
