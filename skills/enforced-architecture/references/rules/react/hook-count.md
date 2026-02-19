# react/hook-count

| Field | Value |
|---|---|
| **Tag** | react |
| **Mechanism** | Structural script (cross-file, pre-commit + CI) |
| **Blocking** | No (warning only) |

## What it prevents

Components with too many hook calls. A component calling 7+ hooks is doing too much — it has accumulated responsibilities that should be extracted into one or more custom hooks.

High hook counts indicate:
- Mixed concerns (data fetching, form state, animations, subscriptions in one component)
- Opportunities for reusable custom hooks that encapsulate related state and effects
- Components that are hard to test because they depend on many stateful behaviors
- Difficulty reasoning about render behavior when many hooks interact

The fix is not to suppress hooks, but to group related hooks into purpose-named custom hooks (e.g., `useFormValidation`, `useConversationData`). This improves readability, testability, and reusability.

## Where it applies

All `.tsx` files in the component source tree. Typical directories:

- `src/features/*/ui/**/*.tsx`
- `src/shared/ui/**/*.tsx`
- `src/routes/**/*.tsx`

Exclude custom hook definition files (`use*.ts`) — these are the extraction target, not the problem. Also exclude test files.

## Algorithm

Line-based heuristic scan. Does not require a full AST parser.

1. **Find target files** — Walk configured directories, collect `.tsx` files (excluding tests and `use*.ts` hook files).
2. **Extract component boundaries** — Identify exported function declarations and exported arrow function assignments with PascalCase names. Use brace-depth tracking to find function boundaries.
3. **Count hook calls** — Within each component boundary, count lines matching the hook call pattern: `use[A-Z]\w*\(`. This catches `useState`, `useEffect`, `useMemo`, `useCallback`, `useRef`, `useContext`, custom hooks like `useQuery`, etc.
4. **Report** — For each component exceeding the threshold, emit file path, component name, line number, and hook count.

### Why line-based, not AST

Hook calls follow a rigid naming convention (`use` prefix + PascalCase) and always appear as top-level statements within the component function. A regex over lines within function boundaries catches 95%+ of cases with zero dependencies. The remaining edge cases (hooks inside conditional blocks, which are themselves a React rules-of-hooks violation) are not worth the complexity of a full parser.

## Configuration

```typescript
// Threshold for warning
const HOOK_COUNT_WARN = 7;

// Directories to scan
const TARGET_DIRS = [
    "src/features/*/ui",
    "src/shared/ui",
    "src/routes",
];

// Pattern to identify hook calls
const HOOK_CALL_PATTERN = /\buse[A-Z]\w*\s*\(/;

// Files to exclude (custom hook definitions are the solution, not the problem)
const EXCLUDE_PATTERNS = [
    /\.test\.[tj]sx?$/,
    /\/__tests__\//,
    /\/use[A-Z][^/]*\.ts$/,
];
```

**Adjustments:**
- Increase `HOOK_COUNT_WARN` to 10 for projects with complex UI requirements (dashboards, editors) where high hook counts are structurally justified.
- Decrease to 5 for projects with strict composition patterns where even moderate hook counts indicate poor decomposition.
- Add project-specific directories to `TARGET_DIRS` based on where components live.
- Never count hooks in custom hook files — they exist specifically to consolidate hooks.

## Implementation

Bun TypeScript script, delegated from the structural check orchestrator.

Key implementation details:
- **Component extraction** handles both `export function ComponentName()` and `export const ComponentName = () =>` patterns. Only PascalCase names are considered components.
- **Brace-depth tracking** finds component function boundaries without a parser. Walk forward from the function signature, counting `{` and `}`, collecting lines between depth 1 and depth 0.
- **Hook counting** uses the `use[A-Z]` pattern on each line within the component boundary. Counts unique hook calls per line (a line with `const [a, setA] = useState(0)` counts as 1).
- **Comment/string stripping** before pattern matching prevents false positives from hooks mentioned in comments or string literals.

## Example output

```
WARN [hook-count] src/features/chat/ui/ChatPanel.tsx
  ChatPanel (line 24) has 9 hooks (threshold: 7).
  Group related useState/useEffect/useMemo calls into a purpose-named
  custom hook (e.g., useChatMessages). Place the hook file alongside the
  component in the same directory.
  Hook count threshold is configured in the hook-count check script.

WARN [hook-count] src/features/editor/ui/CanvasToolbar.tsx
  CanvasToolbar (line 15) has 11 hooks (threshold: 7).
  Group related hooks into purpose-named custom hooks (e.g., useToolbarState).
  Place the hook file alongside the component in the same directory.
```

## Why non-blocking

False positives exist:
- Components that are intentionally "orchestrator" components gathering many independent hooks for a complex view (dashboards, editors)
- Components where each hook is genuinely independent and extraction would create artificial groupings
- Components in the process of being refactored where the hook count is temporarily high

The warning surfaces the pattern for human review. High hook counts are a strong signal but not an absolute rule — some components legitimately need many hooks. The developer decides whether extraction improves or harms clarity.
