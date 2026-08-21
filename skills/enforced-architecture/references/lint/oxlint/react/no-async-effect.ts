// ─── react/no-async-effect ────────────────────────────────────────────
//
// Makes sure: Every useEffect that does async work returns a cleanup
// function, and no useCallback is async. The effect has one place to set a
// cancelled flag or to abort the request. A `setState` after an `await` does
// not run against a component that React already removed. No async
// useCallback exists, so you never trace one to the effect that calls it.
//
// A `return () => …` anywhere in the effect callback counts as cleanup. To
// read what the cleanup does looks stricter, but it reports effects that
// cancel correctly, and an author answers that with a suppression comment.
//
// Async work is `await`, an async arrow, an async function, and a `.then`
// call. Do not drop the `.then` arm because the `async` flag covers the rest:
// a promise chain has no `async` keyword and starts the same request.
//
// The useCallback arm reports an async useCallback wherever it appears, with
// no test that an effect calls it. That call is often in another file, and
// this rule reads one file. Delete the arm and the indirect form gets no
// report.
//
// The rule reads the extensions that can hold JSX and no others. Move a hook
// into a sibling use*.ts file, a refactor this catalog asks for elsewhere, and
// this rule no longer reads its effects. react/derived-state reads every source
// extension; this one does not.
//
// Which calls are `useEffect` and `useCallback` is `lib/hook-calls.ts`'s answer,
// shared with react/hook-count and react/derived-state — `React.useEffect(…)`
// and an aliased import count, and that file states what does not.
//
// The messages below name TanStack Query. That name is the fix instruction, not a
// detail: a project on SWR, on Apollo, or on a route loader must edit the message
// text to name what it uses. A message that names a package the project does not
// have tells the reader to install one.
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
import { isComponentFile } from "../../policy/declared-trees.ts";
import { hookCallName } from "../lib/hook-calls.ts";
import { createRangeIndex } from "../lib/range-index.ts";

const EFFECT_HOOK = "useEffect";
const CALLBACK_HOOK = "useCallback";

const ASYNC_WORK = "asyncWork";
const CLEANUP = "cleanup";

export const noAsyncEffectRule = defineTreeRule({
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
    if (!isComponentFile(filename)) return {};

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
        if (node.arguments.length === 0) return;
        const hook = hookCallName(callee, context.sourceCode);
        const [callback] = node.arguments;
        if (hook === EFFECT_HOOK) {
          effects.push({ node, callback: callback.range });
        } else if (
          hook === CALLBACK_HOOK &&
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
