# health/trampolines

| Field | Value |
|---|---|
| **Tag** | health |
| **Mechanism** | Structural script (cross-file, pre-commit + CI) |
| **Blocking** | No (warning only) |

## What it prevents

Pass-through wrapper functions that add no behavior beyond forwarding a call to the next layer. These "trampolines" are the failure mode of layered architecture — enforcement creates the layers, and agents dutifully populate them with functions that just call through to the layer below.

A function earns its place in a layer when it adds at least one of:
- Input validation or transformation
- Authorization / policy checks
- Multi-dependency orchestration (calling 2+ lower-layer functions)
- Error normalization or telemetry
- Control flow (conditionals, loops, early returns)

If none of these apply and the layer below is absent, the wrapper should be deleted and the caller should reach through directly. However, when the layer exists, `boundary/layer-occupancy` requires traffic to flow through it. In that case, replace the forwarding function with a re-export (`export { repoFn as serviceFn } from "../repo/x"`). A re-export maintains the layer contract without a function body that forwards.

## Where it applies

`src/features/*/service/**/*.ts` — the service layer is where trampolines most commonly appear. Repo functions are excluded because their job IS to wrap DB calls; thin Drizzle query wrappers are the expected pattern.

Expand to other layers if your project has intermediate layers (e.g., a `handlers/` layer between controllers and service).

## Algorithm

Heuristic-based, not full AST analysis. Catches the most common pattern: exported functions whose body contains no variable declarations, no control flow, and no error handling.

1. **Find target files** — Walk `features/*/service/` directories, collect `.ts` files (excluding tests).
2. **Extract function bodies** — Parse exported function declarations and exported object methods. Use brace-depth tracking to find function boundaries.
3. **Check for behavior keywords** — Strip comments and string literals, then test for: `const`, `let`, `var`, `if`, `for`, `while`, `switch`, `try`, `throw`, `catch`. If none appear, the function is likely a trampoline.
4. **Report** — Emit file path, function name, and line number for each suspected trampoline.

### Why heuristic, not AST

A full AST parser (via TypeScript compiler API) would be more precise but adds a heavy dependency to a pre-commit check. The keyword heuristic catches 90%+ of trampolines with near-zero false positives — a function with no variable declarations, no conditionals, and no error handling is almost always just `return repo.doThing(args)`.

## Configuration

```typescript
// Directories to scan for trampolines
const TARGET_LAYERS = ["service"];

// Keywords that indicate real behavior (not a trampoline)
const BEHAVIOR_KEYWORDS =
  /\b(const|let|var|if|for|while|switch|try|throw|catch)\b/;
```

**Adjustments:**
- Add `"handlers"` or other intermediate layers to `TARGET_LAYERS` if your project has them.
- Never add `"repo"` — thin DB wrappers are expected there.
- The keyword list is intentionally conservative. `return` alone doesn't count as behavior — a function that just `return`s another function's result is the definition of a trampoline.

## Implementation

Bun TypeScript script, delegated from the structural check orchestrator.

Key implementation details:
- **Function extraction** handles both `export function name()` and methods inside `export const obj = { name() {} }` patterns.
- **Brace-depth tracking** finds function boundaries without a parser. Walk forward from the function signature, counting `{` and `}`, collecting lines between depth 1 and depth 0.
- **Comment/string stripping** before keyword matching prevents false negatives from keywords appearing in strings or comments.
- **`isInsideExportedObject()`** walks backward from a method definition to determine if it's inside an `export const x = {` block.

## Example output

```
WARN [trampolines] src/features/billing/service/subscriptions.ts
  Likely trampoline: getSubscription() (line 14) forwards a call without adding
  validation, orchestration, error handling, or transformation.
  Delete the wrapper and call the underlying function directly, or add real
  behavior (validation, orchestration, error mapping) to justify the layer.
  If intentional (e.g., stable API seam for testing), no action needed.

WARN [trampolines] src/features/billing/service/subscriptions.ts
  Likely trampoline: listSubscriptions() (line 22) forwards a call without adding
  validation, orchestration, error handling, or transformation.
  Delete the wrapper and call the underlying function directly, or add real
  behavior (validation, orchestration, error mapping) to justify the layer.
  If intentional (e.g., stable API seam for testing), no action needed.
```

## Why non-blocking

False positives exist:
- Functions that add logging or telemetry via a single function call (no keywords detected)
- Functions that exist as a stable API seam for testing
- Functions that will grow to add orchestration in an upcoming change

The warning surfaces the pattern for human review. If the trampoline is intentional, no action needed. If it's not, delete the wrapper and update callers.
