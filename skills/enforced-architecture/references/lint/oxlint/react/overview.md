# react — React code smell detection

`no-direct-fetch` assumes somewhere better exists for a request to live. On a project without one it blocks the only option.

| Rule | Blocking | What it prevents |
|---|---|---|
| [derived-state](derived-state.ts) | Yes | `useState` + `useEffect` for values that should be computed inline or with `useMemo` |
| [no-direct-fetch](no-direct-fetch.ts) | Yes | `fetch()` calls in `.tsx` component files (use server functions or TanStack Query) |
| [single-component-export](single-component-export.md) | No | Multiple exported React components in one file (compound components via `Object.assign` are fine) |
| [no-async-effect](no-async-effect.ts) | Yes | Async operations in useEffect without cleanup, or async useCallback (typically called from effects without cleanup) |
| [hook-count](hook-count.md) | No | Components with 7+ hook calls (doing too much, extract custom hook) |
| [prop-count](prop-count.md) | No | Components with 8+ props (needs decomposition or context) |

Adoption mechanics, the spec contract, and cross-tag rule selection: [../../overview.md](../../overview.md).
