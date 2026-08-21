// ─── react/hook-count ─────────────────────────────────────────────────
//
// Shows: Each exported component that makes 7 or more hook calls, and the
// count. To test such a component, a developer must set up every one of its
// hooks, and this count is that number. The rule warns and does not fail the
// build, because some components collect independent hooks by design.
//
// The count is per component and not per file. A file that holds a component
// and the custom hook extracted out of it is the shape this rule asks for. A
// sum over the file reports that shape as the problem.
//
// A custom hook is never a subject. It is the target of the extraction, and a
// report against it tells the author that the extraction was of no use. The
// classifier keys on the capital letter, thus `usePanelState` is not a
// component and gets no count of its own.
//
// Hook calls in nested callbacks and in conditionals count. To skip them looks
// more correct, because the rules of hooks do not permit them there. But then
// this rule and the React lint plugin disagree about what a hook call is.
//
// No kind of hook counts for more than another. Seven `useState` calls and
// seven different hooks are the same finding, and which hooks matter most is
// a judgement for the reader.
//
// Which calls ARE hooks is `lib/hook-calls.ts`'s answer, shared with
// react/no-async-effect and react/derived-state — `React.useEffect(…)` and an
// aliased import count, and that file states what does not.
//
// Two components in one file is react/single-component-export's finding.
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
import { type Range } from "@oxlint/plugins";
import { isComponentFile } from "../../policy/declared-trees.ts";
import { exportedComponents } from "../lib/component-declarations.ts";
import { hookCallName } from "../lib/hook-calls.ts";
import { numericRuleOption } from "../lib/rule-options.ts";

const DEFAULT_THRESHOLD = 7;

export const hookCountRule = defineTreeRule({
  meta: {
    type: "suggestion",
    schema: [
      {
        type: "object",
        properties: { threshold: { type: "integer", minimum: 1 } },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ threshold: DEFAULT_THRESHOLD }],
    messages: {
      tooManyHooks:
        "{{name}} calls {{hooks}} hooks (threshold: {{threshold}}). Group the related ones into a purpose-named custom hook — the hooks that move together, not the ones that share a type — and put it in a sibling use*.ts file. If the component is genuinely an orchestrator gathering independent hooks, leave it: this is a warning for that reason.",
    },
  },
  create(context) {
    if (!isComponentFile(context.filename)) return {};

    const threshold = numericRuleOption(context.options[0], "threshold", DEFAULT_THRESHOLD);
    // Recorded on the way past and attributed at the end: a visitor reaches a component's function
    // before the hook calls inside it, so "how many hooks are in this subtree" cannot be answered
    // when the component is visited.
    const hookCalls: Range[] = [];

    return {
      CallExpression(node) {
        if (hookCallName(node.callee, context.sourceCode) !== undefined) {
          hookCalls.push(node.range);
        }
      },

      "Program:exit"(program) {
        for (const component of exportedComponents(program, context.sourceCode)) {
          if (component.fn === null) continue;

          const [start, end] = component.fn.range;
          const hooks = hookCalls.filter(([at]) => at >= start && at < end).length;
          if (hooks < threshold) continue;

          context.report({
            node: component.node,
            messageId: "tooManyHooks",
            data: { name: component.name, hooks, threshold },
          });
        }
      },
    };
  },
});
