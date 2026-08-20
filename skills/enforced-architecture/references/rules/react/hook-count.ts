// ─── react/hook-count ─────────────────────────────────────────────────
//
// Tag:       react
// Mechanism: oxlint JS plugin (per-file, real-time)
// Blocking:  No — a warning. A crowded component is sometimes a genuine
//            orchestrator, and the author decides which.
//
// Prevents:  Components that have quietly accumulated responsibilities. Data
//            fetching, form state, subscriptions, and animation in one render
//            body is a set of custom hooks that was never extracted.
//
// The count is per COMPONENT, not per file: a file holding a component and the
// custom hook extracted out of it is the shape this rule asks for, and summing
// the file reports the fix as the problem.
//
// See react/hook-count.md for the rest.
//
// ── Adapt ──
// `threshold` is a rule option — `["warn", { "threshold": 7 }]`. Raise it for a
// codebase whose components legitimately orchestrate; calibrate against the
// current tree and set it just above, so it signals growth rather than firing on
// day one.
//
// ──────────────────────────────────────────────────────────────────────

import { defineRule, type ESTree, type Range } from "@oxlint/plugins";
import { isArchitectureExemptPath, isComponentFile } from "../lib/architecture-exempt-paths.ts";
import { exportedComponents } from "../lib/component-declarations.ts";

/** React's convention, and what `use` in a call position means without a type checker. */
const HOOK_NAME = /^use[A-Z]/;

const DEFAULT_THRESHOLD = 7;

export const hookCountRule = defineRule({
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
    if (isArchitectureExemptPath(context.filename) || !isComponentFile(context.filename)) return {};

    const threshold = context.options[0]?.threshold ?? DEFAULT_THRESHOLD;
    // Recorded on the way past and attributed at the end: a visitor reaches a component's function
    // before the hook calls inside it, so "how many hooks are in this subtree" cannot be answered
    // when the component is visited.
    const hookCalls: Range[] = [];

    return {
      CallExpression(node) {
        if (isHookCallee(node.callee)) hookCalls.push(node.range);
      },

      "Program:exit"(program) {
        for (const component of exportedComponents(program)) {
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

/** `useThing(…)` and the namespaced spelling `React.useThing(…)`. */
function isHookCallee(callee: ESTree.CallExpression["callee"]): boolean {
  if (callee.type === "Identifier") return HOOK_NAME.test(callee.name);
  return (
    callee.type === "MemberExpression" &&
    !callee.computed &&
    callee.property.type === "Identifier" &&
    HOOK_NAME.test(callee.property.name)
  );
}
