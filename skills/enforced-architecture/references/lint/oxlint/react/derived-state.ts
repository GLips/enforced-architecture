// ─── react/derived-state ─────────────────────────────────────────────
//
// Makes sure: No useEffect calls a useState setter with a value it computes
// from what the render already has. Such a value comes from an expression or
// from useMemo, so it is right on the first render and after every prop
// change. The component renders once for a prop change and not twice. You do
// not search for the effect that writes a value you read.
//
// An effect that awaits, calls `.then`, starts a timer, or adds an event
// listener is never a finding. Each one sets state from outside the render
// pass, and no expression replaces it. Add the project's own deferral calls —
// `requestAnimationFrame`, a debounce helper, an event-bus `.on` — beside
// them. Delete one instead, and the rule blocks a build over a correct effect.
//
// A setter counts only when the same file destructures it from useState, and
// the NAME it is bound to is not a second test. `const [total, updateTotal] =
// useState(0)` binds a setter, so adding a `set[A-Z]` test would quietly make
// the destructure not the question after all — the rule would keep reporting
// every ordinary spelling and say nothing about that one. A helper named
// `setTitle()` is no finding, and neither is a setter from a custom hook: both
// fail the destructure, which is the one test.
//
// This rule reads every source extension, unlike the other react rules, which
// read only the ones that can hold JSX. A custom hook in a .ts module holds the
// same useState and useEffect pair. Add an `isComponentFile` guard here to match
// the siblings, and the rule reads no hook module at all.
//
// Which calls are `useState` and `useEffect` is `lib/hook-calls.ts`'s answer,
// shared with react/hook-count and react/no-async-effect — `React.useEffect(…)`
// counts, and an import counts under the name the EXPORTING module gave it, so
// `useEffect as useE` is a hook and `createStore as useStore` is not. That file
// states the rest of what does not count.
//
// SCOPE, and it is the same for every TREE-SCOPED rule in this catalog — which
// is every rule but `testing/no-module-mocking`, whose subject is a test file and
// which is therefore enabled globally. This rule is silent outside the declared
// trees, and silent on the files `isArchitectureExemptSourcePath` names inside
// them — tests, scripts, generated and ambient modules. Neither
// silence is coverage. `lib/define-tree-rule.ts` owns both, which is why no rule
// body checks either one.
// ──────────────────────────────────────────────────────────────────────

import { defineTreeRule } from "../lib/define-tree-rule.ts";
import { type ESTree, type Range } from "@oxlint/plugins";
import { hookCallName } from "../lib/hook-calls.ts";
import { createRangeIndex } from "../lib/range-index.ts";

const STATE_HOOK = "useState";
const EFFECT_HOOK = "useEffect";
const TIMER_SCHEDULERS = new Set(["setTimeout", "setInterval"]);
const DEFERRED_METHODS = new Set(["then", "addEventListener"]);

const NOT_DERIVED_STATE = "notDerivedState";
const setterTag = (name: string) => `setter:${name}`;

export const derivedStateRule = defineTreeRule({
  meta: {
    type: "problem",
    messages: {
      derivedState:
        "A useState setter is called inside useEffect to synchronize derived state. Compute the value inline or with useMemo().",
    },
  },
  create(context) {

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
        if (hookCallName(init.callee, context.sourceCode) !== STATE_HOOK) return;
        if (id.type !== "ArrayPattern") return;
        const setter = id.elements[1];
        if (setter?.type === "Identifier") stateSetters.add(setter.name);
      },
      CallExpression(node) {
        const { callee } = node;

        if (hookCallName(callee, context.sourceCode) === EFFECT_HOOK && node.arguments.length > 0) {
          const [callback] = node.arguments;
          effects.push({ node, callback: callback.range });
          return;
        }

        if (callee.type === "Identifier") {
          // A scheduler's excuse is the finding's opposite — an effect that schedules work sets
          // state outside the render pass — so it takes this arm and records nothing else. Two
          // records for one call would not change the verdict, since the exit check asks about the
          // deferral first, but they would say two things about one node.
          if (TIMER_SCHEDULERS.has(callee.name)) {
            index.record(NOT_DERIVED_STATE, node.range);
            return;
          }
          // EVERY other call by name, not just the `set*` ones. Which names are setters is decided
          // at Program:exit against what the file destructured from useState, and a name test here
          // would be a second, narrower answer to the same question.
          index.record(setterTag(callee.name), node.range);
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
