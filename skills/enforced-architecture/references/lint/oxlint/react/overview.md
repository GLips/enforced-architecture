# react — React code smell detection

`no-direct-fetch` assumes somewhere better exists for a request to live. On a project without one it blocks the only option.

| Rule | Blocking | What it buys |
|---|---|---|
| [derived-state](derived-state.ts) | Yes | A computed value is right on the first render, and a prop change costs one render |
| [no-direct-fetch](no-direct-fetch.ts) | Yes | Two components that ask for the same data make one request and share one cache entry |
| [single-component-export](single-component-export.ts) | No | Which components a search by name finds only at their call sites |
| [no-async-effect](no-async-effect.ts) | Yes | Every async effect has one place to cancel, and no useCallback is async |
| [hook-count](hook-count.ts) | No | The number of hooks a test of the component must set up |
| [prop-count](prop-count.ts) | No | Which components make every call site supply many values, and which one to split next |

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

Adoption mechanics, the spec contract, and what part of the tree owns each rule's subject: [../../overview.md](../../overview.md).
