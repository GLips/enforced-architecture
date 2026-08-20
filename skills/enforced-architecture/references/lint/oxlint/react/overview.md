# react — React code smell detection

`no-direct-fetch` assumes somewhere better exists for a request to live. On a project without one it blocks the only option.

| Rule | Blocking | What it buys |
|---|---|---|
| [derived-state](derived-state.ts) | Yes | `useState` + `useEffect` for values that should be computed inline or with `useMemo` |
| [no-direct-fetch](no-direct-fetch.ts) | Yes | `fetch()` calls in `.tsx` component files (use server functions or TanStack Query) |
| [single-component-export](single-component-export.ts) | No | The files that export more than one component, and all of the component names |
| [no-async-effect](no-async-effect.ts) | Yes | Async operations in useEffect without cleanup, or async useCallback (typically called from effects without cleanup) |
| [hook-count](hook-count.ts) | No | Each exported component that makes 7 or more hook calls, and the count |
| [prop-count](prop-count.ts) | No | Each exported component that declares `threshold` props or more, and the count |

`hook-count`, `prop-count` and `single-component-export` read one component classifier,
[lib/component-declarations.ts](../lib/component-declarations.ts). Take one of the three, and copy
that file with it. A declaration form the classifier does not read is a component that all three
rules skip, with no report. A project with an unusual component wrapper, `observer` from mobx for
example, gets a clean run from all three. That run covers fewer components than the three rule ids
promise.

`hook-count` and `prop-count` warn and never block, and that severity is a decision. A component
that assembles a complex view collects many independent hooks by design. A design-system primitive,
or a wrapper for a third-party component, declares many props by design. If either count blocks the
build, an author writes a suppression comment, and the report is then incomplete.

Set `threshold` on each of the two counts from the current tree: just above the highest count in it.
The rule then reports growth, and not the code that is there on the day of adoption. A `threshold`
below the current tree makes `prop-count` report almost every component in a component library.

Adoption mechanics, the spec contract, and cross-tag rule selection: [../../overview.md](../../overview.md).
