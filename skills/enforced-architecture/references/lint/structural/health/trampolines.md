# health/trampolines

| Field | Value |
|---|---|
| **Tag** | health |
| **Mechanism** | Structural check (cross-file, pre-commit + CI) |
| **Blocking** | No (warning only) |

Implementation: [trampolines.ts](trampolines.ts).

## What it prevents

Pass-through wrapper functions that add nothing beyond forwarding a call to the next layer. These are the failure mode of layered architecture, and they are *caused* by the rest of this catalog: enforcement creates the layers, and agents dutifully populate them with functions that just call through.

A function earns its place in a layer when it adds at least one of:

- input validation or transformation
- authorization or policy checks
- multi-dependency orchestration (calling two or more lower-layer functions)
- error normalization, or telemetry
- control flow — a conditional, a loop, an early return

If none of those apply and the layer below is not absent, delete the wrapper and call the lower dependency directly. When occupancy rules mean the name genuinely has to exist at this layer, re-export it rather than reimplementing it as a forward:

```typescript
export { repoFn as serviceFn } from "../repo/x";
```

That is one line instead of five, and it keeps the definition in one place, so a reader following the name lands on the code rather than on another hop.

## Where it applies

`features/*/<layer>/**/*.ts` for each layer in `targetLayers`, defaulting to `service` — the layer where trampolines actually accumulate.

**The repo layer is excluded, and that exclusion is load-bearing.** A repo function's whole job is to wrap a DB call, so every function in it is a trampoline by body and none of them is a trampoline in fact. Point this check at `repo` and it reports the entire layer, which is how a check gets switched off. The fixture tree keeps a repo file full of textbook forwards as a legal neighbour for exactly this reason: if the layer scoping ever slips, that file starts reporting.

## Why heuristic, not AST

Two decisions, and they are separable.

It is a **script** because its subject is where a file sits rather than what a file says: the same function body is a finding under `service/` and correct under `repo/`, so the check has to walk layer-scoped roots rather than be handed one file at a time.

It stays a **heuristic** because a real parse is not worth its price here. Reaching for the TypeScript compiler API puts a heavy dependency in a pre-commit hook to answer a question the text already answers: a function with no variable declarations, no conditionals and no error handling is almost always just `return repo.doThing(args)`. What the heuristic buys in precision it would spend in install size and startup time on every commit.

The two forms it reads are `export function name()` and methods of an `export const obj = { name() {} }`. An exported arrow (`export const name = () => …`) is not read — name it here if that shape starts appearing, because a form the extractor does not see is a function the check never reports on, and silence reads as a pass.

## Known false positives

The reason this warns rather than blocks. Each of these is a real function that looks exactly like a trampoline to the keyword test:

- **Telemetry or logging through a single call.** `logged(() => repo.get(id))` has no declaration, no branch, and real behaviour.
- **A stable API seam held for testing.** The wrapper exists so callers can be pointed at a fake without touching the layer below.
- **A function about to grow.** The orchestration lands in the next commit; the shape is a stage, not a destination.

The check cannot tell any of these from the thing it is looking for, so it surfaces the pattern and leaves the judgement with a human. If the trampoline is intentional, nothing needs to happen.

## Adapt

`checks["health/trampolines"]`:

- **`targetLayers`** — layer directory names, scanned under every feature. Add an intermediate layer here if the project has one (a `handlers/` between controllers and service is the usual case). **Never add `repo`** — see above; the check will report the whole layer and be rightly ignored.
- **`behaviorKeywords`** — the pattern that means a body does something. Deliberately conservative, and deliberately without `return`: a function that just returns another function's result is the definition of a trampoline, so counting `return` as behaviour silences every true positive at once and leaves the check reporting clean.

`source.featuresDirName` decides what the feature directory is called, so a project that spells it `modules/` changes it there rather than here.

## Example output

```
WARN [health/trampolines] src/features/billing/service/subscriptions.ts:14
  likely trampoline: getSubscription() forwards a call without adding validation,
  orchestration, error handling, or transformation.
  Delete the wrapper and call the underlying function directly, or re-export it
  (export { repoFn as serviceFn } from "../repo/x") if the layer has to carry the
  name. If it is intentional — a stable seam for testing, or about to grow — no
  action is needed.
```

## Why non-blocking

Every case above is a legitimate function this check reports. Blocking on a judgement the check cannot make forces people to work around it, and a rule that gets worked around teaches that the rules are negotiable — which costs more than the smell it was watching for.

## Fixtures

A plain forwarding declaration is the obvious case. Two adversarial ones, both shapes a natural implementation is silent on: **two methods of an exported object**, since nothing in that file starts with `export function` and a service written as one exported namespace is common; and a forward whose **signature spans lines**, which a line-oriented matcher loses the boundary of and then reports nothing about — indistinguishable from a function that earned its layer. The object case is expected *twice*, because an implementation that finds the first member and stops otherwise reads as working.

Two legal neighbours, for the two ways this over-matches: a service function carrying a `const` and an `if` — and an object-literal return type, which is a run of type members with no keyword in it and which reads as the body if the signature walk stops at the first brace — and a repo file whose functions are all forwards.
