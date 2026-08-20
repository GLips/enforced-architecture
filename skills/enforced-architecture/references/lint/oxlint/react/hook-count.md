# react/hook-count

| Field | Value |
|---|---|
| **Tag** | react |
| **Mechanism** | oxlint JS plugin (per-file, real-time) |
| **Blocking** | No (warning only) |

## What it prevents

A component that has quietly accumulated responsibilities. Seven hook calls in one render body is data fetching, form state, a subscription and an animation sitting side by side — a set of custom hooks that was never extracted.

The count is a proxy, and a good one, for the things that are hard to measure directly: mixed concerns, a component that cannot be tested without standing up every stateful behaviour it touches, and render behaviour nobody can reason about because a dozen hooks interact.

The fix is never to suppress a hook. It is to group the hooks that *move together* — not the ones that share a type — into a purpose-named custom hook (`useChatMessages`, `useToolbarState`) in a sibling `use*.ts` file. The count going down is a side effect; the named concept is the point.

## Why a rule and not a script

It is a count against a **threshold**, but a threshold is a rule option and always was. What kept these three in the script tier was the rule tier being GritQL: a declarative matcher cannot accumulate a count and compare it to a number. A JS plugin is a stateful visitor, so it can.

The move is worth more than tier tidiness. Everything these rules ask — is this a component, what are its parameters, what does its props type declare — is a question about syntax, and a script tier answers it by re-implementing a TypeScript parser out of regexes and brace counting. Every silent failure in these three rules' history came from that parser, not from the counting.

"What is a component" is still one question for all three, answered once in [`lib/component-declarations.ts`](../lib/component-declarations.ts). A declaration form one of them fails to recognise is a component all three skip in silence.

## Where it applies

Every `.tsx` file except tests and scripts.

Every exported component declaration is a subject — `export function Name()`, `export default function`, a generic `export function Name<T>()`, an arrow bound to a `const`, and `memo`/`forwardRef` wrappers, which are unwrapped to the function inside them. Hooks are counted inside each component's own subtree, so a file holding two components is two independent counts and not one sum.

## Negative space

**Custom hook definitions are not subjects, ever.** They are the extraction target, not the problem — reporting one says the extraction was pointless, and that is the fastest way to teach people the warning is noise. It falls out of the classifier keying on the capital letter rather than the name: `usePanelState` is not PascalCase and is never a component. A `use*.ts` module is out of scope twice over, since only `.tsx` is walked.

**A hook is a call, not a line.** `const a = useA(), b = useB()` is two, and `useState<string | null>(…)` is one whatever sits between the name and the paren. Both were live defects when the count was a regex over lines, and both keep adversarial cases: they are free on an AST, and a case that is free to pass is still the case that fails loudly if the rule is ever reimplemented.

**`React.useThing(…)` is the same hook as `useThing(…)`.** A namespaced call is a call.

**It does not care which hooks.** Seven `useState` calls and seven different hooks are the same finding. Weighting them would be a judgement the rule cannot make and the reader can.

**It counts hooks in nested closures too.** A hook call inside a callback or a conditional is a rules-of-hooks violation that the React lint plugin owns; excluding it here would mean the two tiers disagreed about what a hook call is.

**Two components in one file is not this rule's business.** That is `react/single-component-export`.

**A `memo`/`forwardRef` binding is unwrapped, not skipped.** The hooks belong to the function inside the wrapper.

## Adapt

One knob, in `.oxlintrc.json`:

```json
"arch/hook-count": ["warn", { "threshold": 7 }]
```

The count at which a component is reported, inclusive. Raise it for products whose components are genuinely orchestrators (dashboards, editors) where a high count is structural rather than accidental; lower it where strict composition makes even a moderate count a decomposition smell. Calibrate against the current tree and set it just above, so it signals growth instead of firing on day one.

Which files are read is `isArchitectureExemptPath`, shared with every rule in the catalog — never restated here.

## Implementation

[`react/hook-count.ts`](hook-count.ts), registered in [`plugin.ts`](../plugin.ts). Registration and activation are separate: a rule the plugin exports but `.oxlintrc.json` never names is loaded and never run.

## Example output

```
src/features/chat/ui/chat-panel.tsx:24:17: warning arch(hook-count): ChatPanel calls 9 hooks
(threshold: 7). Group the related ones into a purpose-named custom hook — the hooks that move
together, not the ones that share a type — and put it in a sibling use*.ts file. If the component
is genuinely an orchestrator gathering independent hooks, leave it: this is a warning for that
reason.
```

## Why non-blocking

The false positives are real ones. An orchestrator component assembling a complex view may gather many genuinely independent hooks, and grouping them would invent a concept that does not exist just to satisfy a counter. A component mid-refactor is temporarily over the line by design.

So the count is a strong signal and not a rule. It surfaces the pattern; the developer decides whether extraction improves the code or only moves the mess. Blocking on a heuristic this soft buys a suppression comment and loses the signal.
