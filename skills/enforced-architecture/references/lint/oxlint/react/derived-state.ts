// ─── react/derived-state ─────────────────────────────────────────────
//
// Tag:      react
// Mechanism: oxlint JS plugin (per-file, real-time)
// Blocking: Yes
//
// Prevents: The "derived state" anti-pattern where useState + useEffect
//           is used to synchronize a value that could be computed inline
//           or with useMemo. The pattern is:
//
//             const [derived, setDerived] = useState(...)
//             useEffect(() => { setDerived(compute(dep)) }, [dep])
//
//           This should be:
//             const derived = useMemo(() => compute(dep), [dep])
//           or simply:
//             const derived = compute(dep)
//
//           The anti-pattern causes unnecessary re-renders (state update
//           triggers a render, then effect runs and triggers another),
//           introduces timing bugs (stale value on first render), and
//           adds complexity for what is fundamentally a computation.
//
// Excludes: Effects whose callback contains `await`, `for await`, a
//           promise `.then`, a timer, or an `addEventListener` — these
//           set state from outside the render pass (streams, polling,
//           subscriptions), which is not synchronous derivation.
//
// Applies:  All .tsx and .ts files EXCEPT:
//           - Test files and scripts
//
// Error:    "A useState setter is called inside useEffect to synchronize
//            derived state. Compute the value inline or with useMemo()."
//
// ── Adapt ─────────────────────────────────────────────────────────────
//
// 1. Which hooks the rule reads — `STATE_HOOK` and `EFFECT_HOOK`:
//    A setter only counts if it was destructured from `STATE_HOOK` in
//    the same file, so a plain helper called `setTitle()` is not a
//    finding. If the project gets setters from custom hooks that wrap
//    useState, drop the `stateSetters` membership test in `Program:exit`
//    and report on `SETTER_NAME` alone — that trades false negatives for
//    false positives. Add `useLayoutEffect` beside `EFFECT_HOOK` if the
//    project uses it for the same work.
//
// 2. What a setter looks like — `SETTER_NAME`:
//    The React convention is `setX`. Adjust if the project names state
//    setters some other way.
//
// 3. False positive tolerance — `TIMER_SCHEDULERS` and `DEFERRED_METHODS`:
//    These name the escape hatches: an effect that schedules, awaits, or
//    subscribes is interacting with an external system, not deriving.
//    Add the project's own deferral primitives (`requestAnimationFrame`,
//    a debounce helper, an event-bus `.on`) if they produce false
//    positives. If false positives are still common, consider making
//    this rule non-blocking; the default is blocking because the
//    anti-pattern is far more common than the legitimate uses.
//
// 4. Registration:
//    Add the rule to the project's oxlint plugin
//    (`rules: { "derived-state": derivedStateRule }`) and turn it on in
//    `.oxlintrc.json` (`"<plugin>/derived-state": "error"`).
//
// ──────────────────────────────────────────────────────────────────────

import { defineRule, type ESTree, type Range } from "@oxlint/plugins";
import { isArchitectureExemptPath } from "../lib/architecture-exempt-paths.ts";
import { createRangeIndex } from "../lib/range-index.ts";

const STATE_HOOK = "useState";
const EFFECT_HOOK = "useEffect";
const SETTER_NAME = /^set[A-Z]/;
const TIMER_SCHEDULERS = new Set(["setTimeout", "setInterval"]);
const DEFERRED_METHODS = new Set(["then", "addEventListener"]);

const NOT_DERIVED_STATE = "notDerivedState";
const setterTag = (name: string) => `setter:${name}`;

export const derivedStateRule = defineRule({
  meta: {
    type: "problem",
    messages: {
      derivedState:
        "A useState setter is called inside useEffect to synchronize derived state. Compute the value inline or with useMemo().",
    },
  },
  create(context) {
    if (isArchitectureExemptPath(context.filename)) return {};

    // "Does this effect callback contain a setter call, and nothing that excuses it?" is a question
    // about a subtree, and a visitor reaches the callback before anything inside it. Ranges recorded
    // on the way past, asked at Program:exit.
    const index = createRangeIndex();
    const effects: { node: ESTree.CallExpression; callback: Range }[] = [];
    const stateSetters = new Set<string>();

    return {
      AwaitExpression(node) {
        index.record(NOT_DERIVED_STATE, node.range);
      },
      ForOfStatement(node) {
        if (node.await) index.record(NOT_DERIVED_STATE, node.range);
      },
      // `const [value, setValue] = useState(…)`, including the hole spelling `const [, setValue]`.
      VariableDeclarator(node) {
        const { id, init } = node;
        if (init === null || init.type !== "CallExpression") return;
        if (init.callee.type !== "Identifier" || init.callee.name !== STATE_HOOK) return;
        if (id.type !== "ArrayPattern") return;
        const setter = id.elements[1];
        if (setter?.type === "Identifier") stateSetters.add(setter.name);
      },
      CallExpression(node) {
        const { callee } = node;

        if (callee.type === "Identifier") {
          // Ordered before the setter test on purpose: `setTimeout` satisfies SETTER_NAME.
          if (TIMER_SCHEDULERS.has(callee.name)) {
            index.record(NOT_DERIVED_STATE, node.range);
          } else if (SETTER_NAME.test(callee.name)) {
            index.record(setterTag(callee.name), node.range);
          } else if (callee.name === EFFECT_HOOK && node.arguments.length > 0) {
            const [callback] = node.arguments;
            effects.push({ node, callback: callback.range });
          }
          return;
        }

        if (
          callee.type === "MemberExpression" &&
          !callee.computed &&
          callee.property.type === "Identifier" &&
          DEFERRED_METHODS.has(callee.property.name)
        ) {
          index.record(NOT_DERIVED_STATE, node.range);
        }
      },

      "Program:exit"() {
        for (const { node, callback } of effects) {
          if (index.containedIn(NOT_DERIVED_STATE, callback)) continue;
          for (const setter of stateSetters) {
            if (index.containedIn(setterTag(setter), callback)) {
              context.report({ node, messageId: "derivedState" });
              break;
            }
          }
        }
      },
    };
  },
});
