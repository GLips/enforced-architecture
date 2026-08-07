# react/hook-count

| Field | Value |
|---|---|
| **Tag** | react |
| **Mechanism** | Structural script (counts across a file set, pre-commit + CI) |
| **Blocking** | No (warning only) |

## What it prevents

A component that has quietly accumulated responsibilities. Seven hook calls in one render body is data fetching, form state, a subscription and an animation sitting side by side — a set of custom hooks that was never extracted.

The count is a proxy, and a good one, for the things that are hard to measure directly: mixed concerns, a component that cannot be tested without standing up every stateful behaviour it touches, and render behaviour nobody can reason about because a dozen hooks interact.

The fix is never to suppress a hook. It is to group the hooks that *move together* — not the ones that share a type — into a purpose-named custom hook (`useChatMessages`, `useToolbarState`) in a sibling `use*.ts` file. The count going down is a side effect; the named concept is the point.

## Why this is a script and not a lint rule

Two reasons, and the second is the stronger one.

The answer is a count against a **threshold**, and a threshold is project calibration rather than a fact about the code. A dashboard-heavy product and a strict-composition design system want different numbers, and that number belongs in the one config object beside the other counting checks — not inside a rule body where nobody can enumerate it.

And "what is a component" is a question three checks ask. This one, `react/prop-count` and `react/single-component-export` all resolve it through the shared classifier in `scripts/component-declarations.ts`, so they govern the same set of declarations instead of holding three private opinions about it. A declaration form one of them fails to recognise is a component all three skip in silence — which is exactly the failure that classifier exists to have exactly once.

## Where it applies

Every `.tsx` file under the configured component roots, walked from the **source root**: `features/*/ui`, `shared/ui`, `routes` by default.

Every exported component declaration in those files is a subject — `export function Name()`, `export default function`, a generic `export function Name<T>()`, an arrow bound to a `const`, and `memo`/`forwardRef` wrappers. Hooks are counted inside each component's brace-tracked body, so a file holding two components is two independent counts and not one sum.

## Negative space

**Custom hook definitions are not subjects, ever.** They are the extraction target, not the problem — reporting one says the extraction was pointless, and that is the fastest way to teach people the warning is noise. It falls out of the classifier keying on the capital letter rather than the name: `usePanelState` is not PascalCase and is never a component. A `use*.ts` module is out of scope twice over, since only `.tsx` is walked.

**The hook matcher tolerates a generic type ARGUMENT between the name and the paren.** `useState<string | null>(…)`, `useRef<HTMLDivElement>(null)`. Without that clause every generic-annotated hook is skipped, which in TS React is most of them, and the components undercounted furthest are precisely the crowded ones this rule exists to find. The same gap one level up — a generic component putting its type *parameters* between the name and the paren — is the classifier's to close, and it does.

**Every hook on a line counts, not the first.** `const a = useA(), b = useB()` is two. A per-line count understates crowding exactly where crowding is worst, and the implementation uses `matchAll` rather than a loop over `.test()` because a shared `/g` regex carries a `lastIndex` from call to call that skips every other match. Both spellings were live defects; both have adversarial fixtures.

**It does not care which hooks.** Seven `useState` calls and seven different hooks are the same finding. Weighting them would be a judgement the rule cannot make and the reader can.

**It counts hooks in nested closures too.** A hook call inside a callback or a conditional is a rules-of-hooks violation that the React lint plugin owns; excluding it here would mean the two tiers disagreed about what a hook call is.

**Two components in one file is not this rule's business.** That is `react/single-component-export`.

**A configured root that does not exist reports nothing.** That tolerance is deliberate and it is also how a root goes unexercised for months while looking fine, which is why the fixture tree carries a firing case under *each* of the three defaults.

## Adapt

Both knobs are `config.checks["react/hook-count"]`:

- **`threshold`** — the count at which a component is reported, inclusive. Raise it for products whose components are genuinely orchestrators (dashboards, editors) where a high count is structural rather than accidental; lower it where strict composition makes even a moderate count a decomposition smell. Calibrate against the current tree and set it just above, so it signals growth instead of firing on day one.
- **`targetDirs`** — globs naming where components live, **relative to the source root**, not the project root. Globbed rather than listed because `features/*/ui` is a set that grows. A mistyped entry is silence, not an error.

Test files, generated files and declaration files come out of `source.exclude`, which every check shares — never restate them here.

## Implementation

[`react/hook-count.ts`](hook-count.ts), behind the structural orchestrator. It returns findings and never prints or exits; reporting, warning suppression for files a commit did not touch, and the exit code all belong to `scripts/run-structural-checks.ts`.

## Example output

```
WARN [react/hook-count] src/features/chat/ui/chat-panel.tsx:24
  ChatPanel calls 9 hooks (threshold: 7).
  Group the related ones into a purpose-named custom hook — the hooks that
  move together, not the ones that share a type — and put it in a sibling
  use*.ts file. If the component is genuinely an orchestrator gathering
  independent hooks, leave it: this is a warning for that reason.
```

## Why non-blocking

The false positives are real ones. An orchestrator component assembling a complex view may gather many genuinely independent hooks, and grouping them would invent a concept that does not exist just to satisfy a counter. A component mid-refactor is temporarily over the line by design.

So the count is a strong signal and not a rule. It surfaces the pattern; the developer decides whether extraction improves the code or only moves the mess. Blocking on a heuristic this soft buys a suppression comment and loses the signal.
