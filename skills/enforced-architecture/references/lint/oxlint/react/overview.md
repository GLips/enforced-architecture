# react — React code smell detection

Nothing here fences the network. A request written in a component is
[boundary/ambient-globals](../boundary/ambient-globals.ts)' finding, in every file of the tree and
not only in `.tsx` — it resolves references, so a local `fetch` binding is not a read, and the
computed and cast host spellings are. This folder holds no second fetch rule and must not grow one.

| Rule | Blocking | What it buys |
|---|---|---|
| [single-component-export](single-component-export.ts) | No | Which components a search by name finds only at their call sites |
| [no-async-effect](no-async-effect.ts) | Yes | Every async effect has one place to cancel, and no useCallback is async |
| [mutation-refresh-keys](mutation-refresh-keys.ts) | Yes | What each write stales is one named bundle in the query-keys module, so sibling writes cannot disagree |
| [hook-count](hook-count.ts) | No | The number of hooks a test must set up — per component, and per custom hook against a higher limit |
| [prop-count](prop-count.ts) | No | Which components make every call site supply many values, and which one to split next |

`hook-count`, `prop-count` and `single-component-export` read one subject classifier,
[lib/component-declarations.ts](../lib/component-declarations.ts). Take one of the three, and copy
that file with it. A declaration form the classifier does not read is a component that all three
rules skip, with no report. A project with an unusual component wrapper, `observer` from mobx for
example, gets a clean run from all three. That run covers fewer components than the three rule ids
promise.

`hook-count` and `no-async-effect` read one hook classifier,
[lib/hook-calls.ts](../lib/hook-calls.ts), for the same reason and with the same instruction: take
one, copy that file with it. The spelling that split them before it existed was `React.useEffect` —
`hook-count` counted it and `no-async-effect` did not, so a file that namespaces its hooks drew a
warning about how many it had and nothing about the leak inside it.

Every rule here gates its COMPONENT subject on the file being able to hold JSX, which is `.tsx` and
`.jsx` both — one owner, `JSX_SOURCE_EXTENSIONS` in `policy/layout.ts`, derived from the source
extension list so the two cannot drift apart. `hook-count` is the one rule with a second subject
that is not a component: a custom hook is counted wherever it is declared, because a `use*.ts`
module is where one belongs and an extension gate there would silence the rule on its own subject.
`mutation-refresh-keys` has no component subject at all and reads every file in the tree, for the
same reason: a mutation lives in a `use*.ts` hook module.

NEGATIVE SPACE: apart from those two, a `use*.ts` hook module holds no JSX and nothing else in this
folder reads one. State derived in an effect there is the shipped `react/set-state-in-effect`'s
finding, not this folder's — see `setup/oxlint.config.ts`. And a PascalCase export in a `.ts` file is
read by nothing here: far more often a factory than a component, so counting it would report a shape
none of these rules has advice for.

`hook-count` and `prop-count` warn and never block, and that severity is a decision. A component
that assembles a complex view collects many independent hooks by design. A design-system primitive,
or a wrapper for a third-party component, declares many props by design. If either count blocks the
build, an author writes a suppression comment, and the report is then incomplete.

Set `threshold` on each of the two counts from the current tree: just above the highest count in it.
The rule then reports growth, and not the code that is there on the day of adoption. A `threshold`
below the current tree makes `prop-count` report almost every component in a component library.

Adoption mechanics, the spec contract, and what part of the tree owns each rule's subject: [../../overview.md](../../overview.md).
