# boundary/layer-occupancy

| Field | Value |
|---|---|
| **Tag** | boundary |
| **Mechanism** | Structural script (cross-file, pre-commit + CI) |
| **Blocking** | Yes |

## What it prevents

Controllers bypassing present layers. The invariant is "skip absent layers, never bypass present ones." This check enforces the "never bypass" half for two layer boundaries:

1. **Repo bypass** — When a feature has a `repo/` directory, controllers cannot import DB schema modules to build queries themselves. All DB query construction must flow through the repo layer. Controllers may still import the DB client (`infrastructure/db/client`) to pass it to repo functions for transaction handling, but schema imports (query construction) must go through repo/.

2. **Service bypass** — When a feature has both `service/` and `repo/` directories, controllers cannot import from repo/ directly. All repo access must flow through the service layer. This prevents controllers from fragmenting orchestration logic by calling some repo functions through service and others directly.

This is the filesystem-aware complement to the per-file DB isolation rule. The per-file rule (db-isolation) restricts which layers can import DB at all. This structural check adds conditional tightening as features graduate: adding repo/ revokes the controller-to-schema shortcut, and adding service/ revokes the controller-to-repo shortcut.

Without this check, a feature could have well-organized service/ and repo/ directories while individual controllers silently bypass them, fragmenting logic across layers.

## Where it applies

`src/features/*/controllers/**/*.ts` — but only for features that have a `src/features/*/repo/` or `src/features/*/service/` directory. Features without either are not checked (their controllers access infrastructure directly).

## Algorithm

Filesystem-aware, not AST-based. Checks directory presence then scans for import patterns.

1. **Enumerate features** — Walk `src/features/*/` directories.
2. **Check for layers** — For each feature, test if `repo/` and/or `service/` exist. If neither exists, skip.
3. **Scan controllers** — Find all `.ts`/`.tsx` files in `controllers/` (excluding tests).
4. **Check for schema imports** — When `repo/` exists, grep for imports matching `@/infrastructure/db/schema`.
5. **Check for repo imports** — When both `service/` and `repo/` exist, grep for relative imports matching `../repo/`.
6. **Exclude type-only imports** — Filter out `import type` statements for both checks. Type imports create no runtime dependency.
7. **Report** — Emit the feature name, file path, and a fix instruction for each violation.

### Why schema but not client?

The DB client import (`@/infrastructure/db/client`) is allowed from controllers even when repo/ exists. Controllers pass the `db` instance to repo functions to enable transaction handling (wrapping multiple repo calls in a single transaction). The client import conveys execution capability; the schema import conveys query construction capability. Only query construction must be concentrated in repo/.

## Configuration

```typescript
// Direct DB query construction (controllers → schema when repo/ exists)
const SCHEMA_IMPORT_PATTERN = /from ['"]@\/infrastructure\/db\/schema/;

// Direct repo access (controllers → repo when service/ exists)
const REPO_IMPORT_PATTERN = /from ['"]\.\.\/repo\//;

// Type-only imports are excluded from both checks
const TYPE_ONLY_IMPORT = /^import type /;
```

**Adjustments:**
- If your DB schema lives elsewhere (e.g., `@/db/schema`), update `SCHEMA_IMPORT_PATTERN`.
- If your project uses different layer names (e.g., `data/` instead of `repo/`, `usecases/` instead of `service/`), update the directory checks and import patterns accordingly.

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

FAIL [layer-occupancy] src/features/agent/controllers/jobs.ts
  Controller imports repo directly, but feature "agent" has a service/ layer.
  Route the call through src/features/agent/service/ instead.
  When service/ exists, controllers must not bypass it to reach repo/.
```
