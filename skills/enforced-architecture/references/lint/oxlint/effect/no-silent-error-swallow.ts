// ─── effect/no-silent-error-swallow ───────────────────────────────────
//
// Makes sure: No catch handler answers a failure with the empty effect.
// `Effect.catchAll`, `Effect.catchTag`, and each branch of an
// `Effect.catchTags` object all count, in the data-first and the data-last
// position. So when a write reports success and the row is absent, you
// read the write, not every handler between it and the caller.
//
// `Effect.unit` and `Effect.succeed(undefined)` are the same value as
// `Effect.void`. Keep all three in the void set, or a handler uses one of
// the other two names and reports nothing.
//
// One correct shape reports: idempotent recovery, such as
// `Effect.catchTag("NotFound", () => Effect.void)` on a delete. Return a
// value that states the outcome (`Effect.succeed({ deleted: false })`), or
// keep the void and disable the rule on that line with the invariant next
// to it. `rg` over the disables is then the list of every deliberate one.
// Do not widen the rule to permit the shape everywhere: that removes the
// list and permits the rest.
//
// EVERY return the handler owns counts, at any statement depth, and a TERNARY
// counts as the branch it is. A log line before the return changes nothing about
// what the handler gives back, and neither does an `if` — `catchAll((e) => {
// if (e._tag === "NotFound") return Effect.void; return Effect.fail(e) })`
// answers one failure with the empty effect while reading as a considered
// narrowing, and `(e) => e._tag === "NotFound" ? Effect.void : Effect.fail(e)`
// is that same handler one keyword over. A handler with two such paths is one
// finding, because it is one edit.
//
// A LOGICAL operator is not read, and it is the one branching form that is not.
// `cond && Effect.void` and `fallback ?? Effect.void` each ship the empty effect
// on one path, and each also ships a non-effect (`false`, `fallback`) on the
// other — so the shape does not typecheck as a handler in the first place and
// the compiler reports it before this rule would.
//
// A return inside a NESTED function is that function's, not the handler's, and
// gets no finding here. `catchAll((e) => rows.map(() => Effect.void))` returns
// an array of effects, which is a different defect and not this one's.
//
// The rule does not follow a handler passed by name
// (`Effect.catchAll(ignoreFailure)`) to its declaration. A handler that
// returns `Effect.logError(…)` has the same type and the same result at
// the caller. Both need the type-aware tier.
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
import { staticKeyName } from "../lib/static-key-name.ts";
import { sourceOrderedReports } from "../lib/source-ordered-reports.ts";
import { type ESTree } from "@oxlint/plugins";

const CATCH_METHODS = new Set(["catchAll", "catchTag", "catchTags"]);
const VOID_EFFECT_MEMBERS = new Set(["void", "unit"]);
const SUCCEED_METHOD = "succeed";

/** The called name, whether `Effect.catchAll(…)`, `Effect["catchAll"](…)`, or a bare import. */
function calledName(callee: ESTree.Expression): string | undefined {
  if (callee.type === "Identifier") return callee.name;
  return callee.type === "MemberExpression"
    ? staticKeyName(callee.property, callee.computed)
    : undefined;
}

// Matched on the member name alone, so a namespace import (`import * as Eff`) resolves the same as
// the conventional `Effect`. `Effect.succeed(undefined)` is included because it is the identical
// value written around a ban on the shorter spelling.
function isEmptyEffect(node: ESTree.Node | null | undefined): boolean {
  if (node === null || node === undefined) return false;
  if (node.type === "MemberExpression") {
    const member = staticKeyName(node.property, node.computed);
    return member !== undefined && VOID_EFFECT_MEMBERS.has(member);
  }
  if (node.type === "CallExpression" && calledName(node.callee) === SUCCEED_METHOD) {
    const [value] = node.arguments;
    if (value === undefined) return false;
    if (value.type === "Identifier" && value.name === "undefined") return true;
    return value.type === "UnaryExpression" && value.operator === "void";
  }
  // Either arm, because either one is what the handler resolves to on some failure. Testing the
  // conditional as a whole reads `Effect.fail(e)` in the other arm as a fix of the swallow beside
  // it, which makes the ternary a one-keyword spelling of every `if` this rule reports.
  // `placement/no-raw-result` recurses at the same node for the same reason.
  if (node.type === "ConditionalExpression") {
    return isEmptyEffect(node.consequent) || isEmptyEffect(node.alternate);
  }
  return false;
}

/**
 * The handler a `return` belongs to, or undefined when the nearest enclosing function is not one.
 *
 * Walked UPWARD from the return rather than downward from the handler, which is what makes depth a
 * non-question: a return inside an `if`, a `switch`, a `try` or a labelled block reaches its
 * handler by the same walk as a top-level one, and none of those statement kinds needs an arm a
 * reader has to notice is absent. The walk stops at the first function it meets, so a return inside
 * a nested callback belongs to that callback and never to the handler around it.
 */
function enclosingCatchHandler(node: ESTree.Node): ESTree.Node | undefined {
  let cursor: ESTree.Node | null = node.parent;
  while (cursor !== null) {
    if (
      cursor.type === "ArrowFunctionExpression" ||
      cursor.type === "FunctionExpression" ||
      cursor.type === "FunctionDeclaration"
    ) {
      return isCatchHandler(cursor) ? cursor : undefined;
    }
    cursor = cursor.parent;
  }
  return undefined;
}

/** Whether a function node sits in a catch call's handler position, directly or as a tag's value. */
function isCatchHandler(handler: ESTree.Node): boolean {
  const { parent } = handler;
  if (parent === null) return false;
  // `catchTags({ NotFound: … })` — the handler is a property value, and the call is two levels up.
  if (parent.type === "Property" && parent.parent?.type === "ObjectExpression") {
    const call = parent.parent.parent;
    return call?.type === "CallExpression" && isCatchCall(call);
  }
  return parent.type === "CallExpression" && isCatchCall(parent);
}

function isCatchCall(node: ESTree.CallExpression): boolean {
  const method = calledName(node.callee);
  return method !== undefined && CATCH_METHODS.has(method);
}

/**
 * The one shape the upward walk cannot reach: a concise arrow body is an EXPRESSION, so there is no
 * `return` anywhere to start from.
 */
function isConciseEmptyHandler(node: ESTree.Node): boolean {
  return (
    node.type === "ArrowFunctionExpression" &&
    node.body.type !== "BlockStatement" &&
    isEmptyEffect(node.body)
  );
}

export const noSilentErrorSwallowRule = defineTreeRule({
  meta: {
    type: "problem",
    messages: {
      silentErrorSwallow:
        "This catch handler returns Effect.void, so the failure leaves the type and the program at once and the caller reads a success. Let the error propagate, map it with Effect.mapError to an error this layer declares, or recover with a real fallback value.",
    },
  },
  create(context) {
    // Both arms find handlers that a single traversal reaches at different moments — a concise body
    // at its call, a block body at a `return` further down the file — so a rule reporting as it goes
    // emits them in neither source nor any other legible order. One owner, per lib's contract.
    const ordered = sourceOrderedReports(context);

    // One report per handler, whatever it takes to get there: a handler with two swallowing returns
    // is one edit, and two diagnostics on it would have the second still standing after the fix.
    const reported = new Set<ESTree.Node>();
    const reportHandler = (handler: ESTree.Node) => {
      if (reported.has(handler)) return;
      reported.add(handler);
      ordered.report({ node: handler, messageId: "silentErrorSwallow" });
    };

    return {
      // `catchTags({ NotFound: … , Conflict: … })` — each tag is its own handler, so each is its
      // own finding. Reporting the object once would hide the second swallow behind the first
      // person to fix the first. Both spellings arrive here through `isCatchHandler`.
      ReturnStatement(node) {
        if (!isEmptyEffect(node.argument)) return;
        const handler = enclosingCatchHandler(node);
        if (handler !== undefined) reportHandler(handler);
      },

      CallExpression(node) {
        if (!isCatchCall(node)) return;

        // Scanning every argument is what makes the data-first and data-last spellings one case
        // instead of three positional branches, each with its own off-by-one.
        for (const argument of node.arguments) {
          if (isConciseEmptyHandler(argument)) {
            reportHandler(argument);
            continue;
          }
          if (argument.type !== "ObjectExpression") continue;
          for (const property of argument.properties) {
            if (property.type === "Property" && isConciseEmptyHandler(property.value)) {
              reportHandler(property.value);
            }
          }
        }
      },

      // This rule owns `Program:exit` outright — see lib/source-ordered-reports.ts for why a
      // spread one cannot be allowed to share the key.
      "Program:exit"() {
        ordered.flushInSourceOrder();
      },
    };
  },
});
