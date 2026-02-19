# react/prop-count

| Field | Value |
|---|---|
| **Tag** | react |
| **Mechanism** | Structural script (cross-file, pre-commit + CI) |
| **Blocking** | No (warning only) |

## What it prevents

Components with too many props. A component accepting 8+ props is a sign that it needs decomposition, a context provider, or a configuration object.

High prop counts indicate:
- The component is doing too much and should be split into smaller, focused components
- Props that always travel together should be grouped into an object or extracted to context
- Parent components are threading data through intermediaries (prop drilling) instead of using context or composition
- The component's API surface is too wide, making it hard to use correctly and prone to misuse

The fix depends on the situation:
- **Decompose:** Split the component into smaller components with narrower prop interfaces
- **Group:** Combine related props into a single object prop (e.g., `style` props, `config` props)
- **Context:** Move shared data to a context provider when multiple levels of components need the same props
- **Composition:** Use children or render props to let the parent own rendering decisions instead of passing configuration props

## Where it applies

All `.tsx` files in the component source tree. Typical directories:

- `src/features/*/ui/**/*.tsx`
- `src/shared/ui/**/*.tsx`
- `src/routes/**/*.tsx`

Exclude test files and type definition files.

## Algorithm

Line-based heuristic scan on function signatures and TypeScript type annotations.

1. **Find target files** — Walk configured directories, collect `.tsx` files (excluding tests).
2. **Extract component signatures** — Identify exported function declarations and exported arrow function assignments with PascalCase names.
3. **Count props** — Two strategies, tried in order:
   a. **Type annotation approach:** Find the Props type/interface for the component (e.g., `type ChatPanelProps = { ... }` or `interface ChatPanelProps { ... }`). Count the number of property signatures in the type body.
   b. **Destructuring approach:** If no explicit Props type is found, examine the function parameter destructuring pattern (e.g., `function Component({ a, b, c, d }: Props)`). Count the destructured identifiers.
4. **Report** — For each component exceeding the threshold, emit file path, component name, line number, and prop count.

### Why two strategies

Some projects define Props types explicitly; others destructure inline. The type annotation approach is more accurate (counts optional props, includes props not destructured). The destructuring fallback catches components without explicit types. Together they cover the vast majority of patterns.

## Configuration

```typescript
// Threshold for warning
const PROP_COUNT_WARN = 8;

// Directories to scan
const TARGET_DIRS = [
    "src/features/*/ui",
    "src/shared/ui",
    "src/routes",
];

// Patterns to identify Props types
const PROPS_TYPE_PATTERNS = [
    /^(?:export\s+)?(?:type|interface)\s+(\w+Props)\s*[={]/,
    /^(?:export\s+)?(?:type|interface)\s+(\w+Properties)\s*[={]/,
];

// Files to exclude
const EXCLUDE_PATTERNS = [
    /\.test\.[tj]sx?$/,
    /\/__tests__\//,
    /\.d\.ts$/,
];
```

**Adjustments:**
- Increase `PROP_COUNT_WARN` to 10-12 for design system component libraries where high prop counts are expected (Button, Input, Table components are inherently configurable).
- Decrease to 6 for applications with strict composition patterns.
- Add project-specific directories to `TARGET_DIRS` based on where components live.
- Add additional Props type naming patterns if your project uses conventions like `ComponentAttrs` or `ComponentConfig`.

## Implementation

Bun TypeScript script, delegated from the structural check orchestrator.

Key implementation details:
- **Props type extraction** searches for `type XProps =` or `interface XProps` declarations. Matches the type name to the component name (e.g., `ChatPanelProps` for `ChatPanel`). Falls back to any `*Props` type in the same file if no exact match is found.
- **Property counting in types** uses brace-depth tracking to find the type body, then counts lines containing property signatures (lines with `:` that are not method signatures or comments).
- **Destructuring fallback** parses the function parameter list when no Props type is found. Counts comma-separated identifiers in the destructuring pattern, handling default values and rest parameters.
- **Spread props exclusion** — Props that spread via `...rest` are counted as 1 regardless of what the rest object contains, since the component is explicitly forwarding them rather than consuming them.
- **Children exclusion** — The `children` prop is not counted toward the threshold since it is a React structural convention, not a component-specific data dependency.

## Example output

```
WARN [prop-count] src/features/billing/ui/PlanSelector.tsx
  PlanSelector (line 18) has 12 props (threshold: 8).
  Consider decomposing into smaller components, grouping related props
  into a single object, or extracting shared data to a context provider.
  Prop count threshold is configured in the prop-count check script.

WARN [prop-count] src/shared/ui/DataTable.tsx
  DataTable (line 32) has 9 props (threshold: 8).
  Consider grouping related props into objects or splitting into smaller
  focused components.
```

## Why non-blocking

False positives exist:
- Design system primitives (Button, Input, Modal) that intentionally expose many configuration props for flexibility
- Wrapper components around third-party libraries that must forward many props to the underlying component
- Components where each prop is genuinely independent and grouping would create artificial objects
- Table/grid components that need column definitions, sorting, filtering, pagination, and selection props

The warning surfaces the pattern for human review. High prop counts are a design smell but not always a defect — the developer decides whether decomposition, context, or the current interface is the right choice.
