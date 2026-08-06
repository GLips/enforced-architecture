// ─── react/no-async-effect ────────────────────────────────────────────
//
// Tag:      react
// Mechanism: oxlint JS plugin (per-file, real-time)
// Blocking: Yes
//
// Prevents: Async operations in React effects without proper cleanup,
//           which leads to memory leaks, stale state updates, and
//           operations continuing after unmount or dependency changes.
//
//           Two patterns are caught:
//
//           1. Async inside useEffect without cleanup return:
//
//                useEffect(() => {
//                  async function load() { ... }
//                  load();
//                }, [dep])           // ← no return () => { ... }
//
//              The async work has no way to cancel when deps change or
//              the component unmounts. setState calls may fire on a dead
//              component, and stale closures can corrupt state.
//
//           2. useCallback(async () => ...) — the indirect form:
//
//                const doWork = useCallback(async () => { ... }, [dep]);
//                useEffect(() => { doWork(); }, [doWork]);
//
//              Wrapping async in useCallback is almost always done to
//              call it from useEffect. The cleanup problem is the same,
//              but harder to spot because the async work is separated
//              from the effect. Additionally, the callback's ref-based
//              guards (e.g., isRunning.current) are fragile across
//              component re-renders and navigation.
//
//           Correct pattern — async effect with cleanup:
//
//                useEffect(() => {
//                  let cancelled = false;
//                  async function run() {
//                    const data = await fetchData();
//                    if (!cancelled) setState(data);
//                  }
//                  run();
//                  return () => { cancelled = true; };
//                }, [dep])
//
//           Better pattern — use a data-fetching library:
//
//                const { data } = useQuery({
//                  queryKey: ['data', dep],
//                  queryFn: () => fetchData(dep),
//                })
//
// Applies:  All .tsx files EXCEPT:
//           - Test files and scripts
//
// ── Adapt ─────────────────────────────────────────────────────────────
//
// 1. Data-fetching library:
//    Both messages reference TanStack Query. If the project uses SWR,
//    Apollo, or a route loader, update the message text — the message is
//    the fix instruction, so it has to name the thing to reach for.
//
// 2. Which hooks the rule reads — `EFFECT_HOOK` and `CALLBACK_HOOK`:
//    Add `useLayoutEffect` beside `EFFECT_HOOK` if the project runs the
//    same work there. In projects that don't use a mutation library,
//    async `CALLBACK_HOOK` for memoized event handlers passed as props
//    is legitimate; if that causes false positives, delete the
//    `CALLBACK_HOOK` branch and the `asyncCallback` message and keep
//    only the effect check. Projects using TanStack Query's useMutation
//    for all async user interactions should not hit this.
//
// 3. Cleanup detection — the `ReturnStatement` visitor:
//    The rule considers an effect "cleaned up" if its callback contains
//    `return () => …` anywhere. This is a heuristic — it doesn't verify
//    the cleanup is correct, only that the developer considered the
//    lifecycle. This is intentionally permissive; catching missing
//    cleanup is far more valuable than auditing cleanup contents.
//
// 4. File scope — `isComponentFile`:
//    Only .tsx files are checked, since an effect only runs in a
//    component. Broaden it in `../lib/architecture-exempt-paths.ts` if
//    the project keeps hooks in .ts modules.
//
// 5. Registration:
//    Add the rule to the project's oxlint plugin
//    (`rules: { "no-async-effect": noAsyncEffectRule }`) and turn it on
//    in `.oxlintrc.json` (`"<plugin>/no-async-effect": "error"`).
//
// ──────────────────────────────────────────────────────────────────────

import { defineRule, type ESTree, type Range } from "@oxlint/plugins";
import {
  isArchitectureExemptPath,
  isComponentFile,
} from "../lib/architecture-exempt-paths.ts";
import { createRangeIndex } from "../lib/range-index.ts";

const EFFECT_HOOK = "useEffect";
const CALLBACK_HOOK = "useCallback";

const ASYNC_WORK = "asyncWork";
const CLEANUP = "cleanup";

export const noAsyncEffectRule = defineRule({
  meta: {
    type: "problem",
    messages: {
      asyncEffect:
        "Async operation inside useEffect without cleanup risks memory leaks and stale state updates. Use TanStack Query for data fetching, or restructure as a single useEffect with a cancelled flag and cleanup return.",
      asyncCallback:
        "Async useCallback is typically called from useEffect without proper cleanup. Use TanStack Query for data fetching, or inline the async logic in a useEffect with a cancelled flag and cleanup return.",
    },
  },
  create(context) {
    const { filename } = context;
    if (!isComponentFile(filename) || isArchitectureExemptPath(filename)) return {};

    // Async work and cleanup are both facts about the effect callback's whole subtree, which a
    // visitor cannot know when it reaches the callback. Every async spelling records its range on
    // the way past — the `async` flag is one field, so an annotated `async (): Promise<T> =>` needs
    // no separate arm the way a source-snippet pattern does.
    const index = createRangeIndex();
    const effects: { node: ESTree.CallExpression; callback: Range }[] = [];

    return {
      AwaitExpression(node) {
        index.record(ASYNC_WORK, node.range);
      },
      ArrowFunctionExpression(node) {
        if (node.async) index.record(ASYNC_WORK, node.range);
      },
      FunctionDeclaration(node) {
        if (node.async) index.record(ASYNC_WORK, node.range);
      },
      FunctionExpression(node) {
        if (node.async) index.record(ASYNC_WORK, node.range);
      },
      // An effect's cleanup is the last thing it returns; a `return () => …` anywhere inside it is
      // the signal that the author thought about unwinding.
      ReturnStatement(node) {
        const returned = node.argument;
        if (returned !== null && returned.type === "ArrowFunctionExpression") {
          index.record(CLEANUP, node.range);
        }
      },
      CallExpression(node) {
        const { callee } = node;

        if (
          callee.type === "MemberExpression" &&
          !callee.computed &&
          callee.property.type === "Identifier" &&
          callee.property.name === "then"
        ) {
          index.record(ASYNC_WORK, node.range);
          return;
        }
        if (callee.type !== "Identifier" || node.arguments.length === 0) return;

        const [callback] = node.arguments;
        if (callee.name === EFFECT_HOOK) {
          effects.push({ node, callback: callback.range });
        } else if (
          callee.name === CALLBACK_HOOK &&
          (callback.type === "ArrowFunctionExpression" ||
            callback.type === "FunctionExpression") &&
          callback.async
        ) {
          context.report({ node, messageId: "asyncCallback" });
        }
      },

      // The two findings are independent claims about the same file, so a component carrying both
      // reports both in one pass rather than surfacing the second only after the first is fixed.
      "Program:exit"() {
        for (const { node, callback } of effects) {
          if (index.containedIn(CLEANUP, callback)) continue;
          if (index.containedIn(ASYNC_WORK, callback)) {
            context.report({ node, messageId: "asyncEffect" });
          }
        }
      },
    };
  },
});
