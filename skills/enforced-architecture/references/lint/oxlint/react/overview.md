# react — React code smell detection

Nothing here fences the network. A request written in a component is
[boundary/ambient-globals](../boundary/ambient-globals.ts)' finding, in every file of the tree and
not only in `.tsx` — it resolves references, so a local `fetch` binding is not a read, and the
computed and cast host spellings are. This folder holds no second fetch rule and must not grow one.

| Rule | Blocking | What it buys |
|---|---|---|
| [derived-state](derived-state.ts) | Yes | A computed value is right on the first render, and a prop change costs one render |
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

`hook-count`, `no-async-effect` and `derived-state` read one hook classifier,
[lib/hook-calls.ts](../lib/hook-calls.ts), for the same reason and with the same instruction: take
one, copy that file with it. The spelling that split them before it existed was `React.useEffect` —
`hook-count` counted it and the two blocking rules did not, so a file that namespaces its hooks drew
a warning about how many it had and nothing about the leak inside it.

Every rule here but `derived-state` gates on the file being able to hold JSX, which is `.tsx` and
`.jsx` both — one owner, `JSX_SOURCE_EXTENSIONS` in `policy/layout.ts`, derived from the source
extension list so the two cannot drift apart. `derived-state` deliberately reads every source
extension: the useState/useEffect pair it watches moves into a `use*.ts` hook module unchanged, and
that module is the refactor this catalog asks for elsewhere.

`hook-count` and `prop-count` warn and never block, and that severity is a decision. A component
that assembles a complex view collects many independent hooks by design. A design-system primitive,
or a wrapper for a third-party component, declares many props by design. If either count blocks the
build, an author writes a suppression comment, and the report is then incomplete.

Set `threshold` on each of the two counts from the current tree: just above the highest count in it.
The rule then reports growth, and not the code that is there on the day of adoption. A `threshold`
below the current tree makes `prop-count` report almost every component in a component library.

Adoption mechanics, the spec contract, and what part of the tree owns each rule's subject: [../../overview.md](../../overview.md).
