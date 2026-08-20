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
// A setter counts only when the same file destructures it from useState. A
// helper named `setTitle()` is no finding, and neither is a setter from a
// custom hook. Report on the `set[A-Z]` name alone to catch those, and the
// rule reports every other function whose name starts with `set` too.
//
// This rule reads .ts as well as .tsx, unlike the other react rules. A custom
// hook in a .ts module holds the same useState and useEffect pair. Add an
// `isComponentFile` guard here to match the siblings, and the rule reads no
// hook module at all.
//
// SCOPE, and it is the same for every rule in this catalog: this rule is silent
// outside the declared trees, and silent on the files `isArchitectureExemptPath`
// names inside them — tests, scripts, generated and ambient modules. Neither
// silence is coverage. `lib/define-tree-rule.ts` owns both, which is why no rule
// body checks either one.
// ──────────────────────────────────────────────────────────────────────

import { defineTreeRule } from "../lib/define-tree-rule.ts";
import { type ESTree, type Range } from "@oxlint/plugins";
import { createRangeIndex } from "../lib/range-index.ts";

const STATE_HOOK = "useState";
const EFFECT_HOOK = "useEffect";
const SETTER_NAME = /^set[A-Z]/;
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
