// ─── react/hook-count ─────────────────────────────────────────────────
//
// Shows: Each exported component that makes 7 or more calls to hooks that hold
// local logic, and each exported custom hook that makes 12 or more, with the
// count. Local logic is state, refs and effects — `useState`, `useReducer`,
// `useRef`, `useEffect` and their kin — and every custom hook, since one wraps
// some of those. Many of them in one subject is a workflow nobody named: flags,
// refs and effects stepping each other along. The rule warns and does not fail
// the build, because some components collect independent state by design.
//
// Data and form wiring does NOT count. A hook from `@tanstack/*` (query,
// router, form, store), a route object's reads (`Route.useLoaderData()`), the
// tree's primed-read wrapper and any module listed in `wiringModules` is a
// subscription to state something else owns. Three queries and a form are a
// screen, not a tangle, and splitting them only adds a hook that forwards.
// React's derivations (`useMemo`, `useCallback`, `useId`, `useContext`,
// `useDeferredValue`, `useDebugValue`) hold nothing either. A React state or
// effect name counts wherever it was imported from, so TanStack Router's
// isomorphic `useLayoutEffect` is an effect like React's.
//
// NEGATIVE SPACE: a project hook that only wraps a TanStack read is counted
// unless its module is the primed-read wrapper or is listed in
// `wiringModules`. One file cannot see what another module's hook does, so the
// project names its wiring modules — the module `createFormHook` builds the
// form hook in is the usual entry.
//
// The count is per subject and not per file. A file that holds a component
// and the custom hook extracted out of it is the shape this rule asks for. A
// sum over the file reports that shape as the problem.
//
// TWO THRESHOLDS, and the gap between them is the whole design. A custom hook
// is the TARGET of the extraction this rule asks a component to perform, so
// judging it by the component's number is a treadmill: extract eight hooks out
// of a component, land on a hook holding seven, get reported again, and the
// only move left is to split the hook into two the component calls — which
// leaves the component calling two hooks and nothing improved. The hook's
// threshold sits well above the component's so that the product of a healthy
// extraction is silent.
//
// What the hook threshold catches is the other thing: a custom hook that grew
// into a module. Twenty-eight stateful hooks behind one `use` name is not an
// extraction, it is a second component with no JSX, and every consumer pays
// for all of it. Extraction products land just above the component's number and
// modules-in-disguise well past it; 12 sits in the gap.
//
// The two messages differ, and that difference is load-bearing rather than
// cosmetic. A component is told to group hooks into a custom hook. Telling a
// custom hook the same thing prescribes the edit it already is, which is the
// edit loop this catalog treats as a defect. The hook's message names the
// splits available to a hook instead.
//
// The classifier keys on the name: PascalCase is a component, `use` followed by
// a capital is a hook, and no name is in both sets. `lib/component-declarations.ts`
// owns both readings so the declaration FORMS cannot differ between them.
//
// Hook calls in nested callbacks and in conditionals count. To skip them looks
// more correct, because the rules of hooks do not permit them there. But then
// this rule and the React lint plugin disagree about what a hook call is.
//
// No counted hook counts for more than another. Seven `useState` calls and
// seven different hooks are the same finding, and which matter most is a
// judgement for the reader.
//
// Which calls ARE hooks is `lib/hook-calls.ts`'s answer, shared with
// react/no-async-effect — `React.useEffect(…)` counts,
// and an import counts under the name the EXPORTING module gave it — so
// `useEffect as useE` is a hook and `createStore as useStore` is not. That file
// states the rest of what does not count.
//
// Two components in one file is react/single-component-export's finding.
//
// NEGATIVE SPACE: a hook is counted wherever it is declared, and a component
// only in a file the project renders from — `isComponentFile` is an extension
// test, and a hook lives in a plain `.ts` as readily as in a `.tsx`. So a
// PascalCase function in a `.ts` file is not counted by anything here, which is
// correct for a factory and wrong for a component somebody put in the wrong
// file. Nothing in this rule reports that; `react/single-component-export`
// does not either.
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
import { exportedComponents, exportedCustomHooks } from "../lib/component-declarations.ts";
import { hookCallOrigin } from "../lib/hook-calls.ts";
import { numericRuleOption, stringListRuleOption } from "../lib/rule-options.ts";
import { aliasSpecifierFor, primedQueryModule } from "../../policy/layout.ts";

const DEFAULT_THRESHOLD = 7;

/**
 * Deliberately not `DEFAULT_THRESHOLD`, and deliberately not a multiple of it. A project moving
 * the component number should not silently move this one: the two answer different questions, and
 * a hook set to the component's value turns the extraction this rule asks for into a loop.
 */
const DEFAULT_HOOK_THRESHOLD = 12;

/** React's hooks that hold state or run effects: local logic wherever the name was imported from. */
const LOCAL_LOGIC_HOOKS = new Set([
  "useState",
  "useReducer",
  "useRef",
  "useEffect",
  "useLayoutEffect",
  "useInsertionEffect",
  "useSyncExternalStore",
  "useTransition",
  "useOptimistic",
  "useActionState",
  "useImperativeHandle",
]);

/** React's hooks that derive or read, holding nothing of their own. */
const REACT_DERIVATION_HOOKS = new Set([
  "useMemo",
  "useCallback",
  "useId",
  "useContext",
  "useDeferredValue",
  "useDebugValue",
]);

const WIRING_PACKAGE_PREFIX = "@tanstack/";

export const hookCountRule = defineTreeRule({
  meta: {
    type: "suggestion",
    schema: [
      {
        type: "object",
        properties: {
          threshold: { type: "integer", minimum: 1 },
          hookThreshold: { type: "integer", minimum: 1 },
          wiringModules: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
    defaultOptions: [
      { threshold: DEFAULT_THRESHOLD, hookThreshold: DEFAULT_HOOK_THRESHOLD, wiringModules: [] },
    ],
    messages: {
      tooManyHooks:
        "{{name}} calls {{hooks}} state, ref, effect or custom hooks (threshold: {{threshold}}; data, form and router reads are not counted). That much local logic is usually a workflow nobody named: give it a machine or reducer, or group the hooks that move together into a purpose-named custom hook in a sibling use*.ts file. If the component genuinely gathers independent state, leave it: this is a warning for that reason.",
      tooManyHooksInHook:
        "{{name}} is a custom hook calling {{hooks}} state, ref, effect or custom hooks (threshold: {{threshold}}). That threshold is higher than a component's on purpose, so this is not the extraction asking to be undone — it is a hook that became a module, and every consumer pays for all of it. Split it into several hooks named for what each one owns and let the caller compose them, or move the parts that do not need React state out into plain functions the hook calls. This warns rather than fails: a hook wrapping one genuinely large machine is a real shape.",
    },
  },
  create(context, role) {
    const threshold = numericRuleOption(context.options[0], "threshold", DEFAULT_THRESHOLD);
    const hookThreshold = numericRuleOption(
      context.options[0],
      "hookThreshold",
      DEFAULT_HOOK_THRESHOLD,
    );
    const wiringModules = new Set([
      aliasSpecifierFor(role.tree.vocabulary, primedQueryModule(role.tree.vocabulary)),
      ...stringListRuleOption(context.options[0], "wiringModules", []),
    ]);
    const holdsLocalLogic = (origin: {
      readonly name: string;
      readonly module: string | undefined;
    }) => {
      if (LOCAL_LOGIC_HOOKS.has(origin.name)) return true;
      if (REACT_DERIVATION_HOOKS.has(origin.name)) return false;
      if (origin.module === undefined) return true;
      return !origin.module.startsWith(WIRING_PACKAGE_PREFIX) && !wiringModules.has(origin.module);
    };
    // Recorded on the way past and attributed at the end: a visitor reaches a subject's function
    // before the hook calls inside it, so "how many hooks are in this subtree" cannot be answered
    // when the subject is visited.
    const hookCalls: Range[] = [];

    return {
      CallExpression(node) {
        const origin = hookCallOrigin(node.callee, context.sourceCode);
        if (origin !== undefined && holdsLocalLogic(origin)) {
          hookCalls.push(node.range);
        }
      },

      "Program:exit"(program) {
        const subjects = [
          // Components only where the project renders: a PascalCase export in a `.ts` file is a
          // factory far more often than a component, and counting it would report the shape this
          // rule has no advice for.
          ...(isComponentFile(context.filename)
            ? exportedComponents(program, context.sourceCode).map((component) => ({
                declaration: component,
                limit: threshold,
                messageId: "tooManyHooks" as const,
              }))
            : []),
          ...exportedCustomHooks(program, context.sourceCode).map((hook) => ({
            declaration: hook,
            limit: hookThreshold,
            messageId: "tooManyHooksInHook" as const,
          })),
        ];
        // Each reader returns its own subjects in source order, and concatenating two of them
        // does not: a file whose hook sits above its component would report the component first.
        // No fixture can pin this — `RuleTester` sorts diagnostics by span before comparing — so
        // it is held here, where the rule's one reporting arm can see both lists at once.
        subjects.sort(
          (one, other) => one.declaration.node.range[0] - other.declaration.node.range[0],
        );

        for (const subject of subjects) {
          if (subject.declaration.fn === null) continue;

          const [start, end] = subject.declaration.fn.range;
          const hooks = hookCalls.filter(([at]) => at >= start && at < end).length;
          if (hooks < subject.limit) continue;

          context.report({
            node: subject.declaration.node,
            messageId: subject.messageId,
            data: { name: subject.declaration.name, hooks, threshold: subject.limit },
          });
        }
      },
    };
  },
});
