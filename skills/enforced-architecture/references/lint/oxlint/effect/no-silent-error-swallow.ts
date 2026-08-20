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
// The rule does not follow a handler passed by name
// (`Effect.catchAll(ignoreFailure)`) to its declaration. A handler that
// returns `Effect.logError(…)` has the same type and the same result at
// the caller. Both need the type-aware tier.
//
// SCOPE, and it is the same for every rule in this catalog: this rule is silent
// outside the declared trees, and silent on the files `isArchitectureExemptPath`
// names inside them — tests, scripts, generated and ambient modules. Neither
// silence is coverage. `lib/define-tree-rule.ts` owns both, which is why no rule
// body checks either one.
// ──────────────────────────────────────────────────────────────────────

import { defineTreeRule } from "../lib/define-tree-rule.ts";
import { type ESTree } from "@oxlint/plugins";

const CATCH_METHODS = new Set(["catchAll", "catchTag", "catchTags"]);
const VOID_EFFECT_MEMBERS = new Set(["void", "unit"]);
const SUCCEED_METHOD = "succeed";

/** The property name when it is statically known — `x.name` or `x["name"]`, never `x[expr]`. */
function staticPropertyName(node: ESTree.MemberExpression): string | null {
  if (!node.computed) return node.property.type === "Identifier" ? node.property.name : null;
  return node.property.type === "Literal" && typeof node.property.value === "string"
    ? node.property.value
    : null;
}

/** The called name, whether `Effect.catchAll(…)`, `Effect["catchAll"](…)`, or a bare import. */
function calledName(callee: ESTree.Expression): string | null {
  if (callee.type === "Identifier") return callee.name;
  return callee.type === "MemberExpression" ? staticPropertyName(callee) : null;
}

// Matched on the member name alone, so a namespace import (`import * as Eff`) resolves the same as
// the conventional `Effect`. `Effect.succeed(undefined)` is included because it is the identical
// value written around a ban on the shorter spelling.
function isEmptyEffect(node: ESTree.Node | null | undefined): boolean {
  if (node === null || node === undefined) return false;
  if (node.type === "MemberExpression") {
    const member = staticPropertyName(node);
    return member !== null && VOID_EFFECT_MEMBERS.has(member);
  }
  if (node.type === "CallExpression" && calledName(node.callee) === SUCCEED_METHOD) {
    const [value] = node.arguments;
    if (value === undefined) return false;
    if (value.type === "Identifier" && value.name === "undefined") return true;
    return value.type === "UnaryExpression" && value.operator === "void";
  }
  return false;
}

/**
 * Every top-level `return` is tested rather than a lone-statement body, because a log line before
 * the return changes nothing about what the handler gives back — and that is the shape the swallow
 * takes once someone has felt uneasy about it. Returns inside a nested function are not the
 * handler's own, so the scan stops at statements this block owns.
 */
function returnsEmptyEffect(node: ESTree.Node | undefined): boolean {
  if (node === undefined) return false;
  if (node.type === "ArrowFunctionExpression" && node.body.type !== "BlockStatement") {
    return isEmptyEffect(node.body);
  }
  if (node.type !== "ArrowFunctionExpression" && node.type !== "FunctionExpression") return false;
  // oxlint models all four function kinds as ONE node interface, and the two body-less kinds —
  // an overload signature, an ambient declaration — keep `body` nullable for every kind. Testing
  // `type` above does not narrow it, so a FunctionExpression that always has a body still has to
  // say so here.
  const body = node.body;
  if (body === null || body.type !== "BlockStatement") return false;
  return body.body.some(
    (statement) => statement.type === "ReturnStatement" && isEmptyEffect(statement.argument),
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

    return {
      CallExpression(node) {
        const method = calledName(node.callee);
        if (method === null || !CATCH_METHODS.has(method)) return;

        // Scanning every argument is what makes the data-first and data-last spellings one case
        // instead of three positional branches, each with its own off-by-one.
        for (const argument of node.arguments) {
          if (returnsEmptyEffect(argument)) {
            context.report({ node: argument, messageId: "silentErrorSwallow" });
            continue;
          }
          // `catchTags({ NotFound: … , Conflict: … })` — each tag is its own handler, so each is
          // its own finding. Reporting the object once would hide the second swallow behind the
          // first person to fix the first.
          if (argument.type !== "ObjectExpression") continue;
          for (const property of argument.properties) {
            if (property.type === "Property" && returnsEmptyEffect(property.value)) {
              context.report({ node: property.value, messageId: "silentErrorSwallow" });
            }
          }
        }
      },
    };
  },
});
