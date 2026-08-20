// ─── effect/no-silent-error-swallow ───────────────────────────────────
//
// Tag:       effect
// Mechanism: oxlint JS plugin (per-file, real-time)
// Blocking:  Yes
//
// Prevents: A catch handler whose whole body is `Effect.void` —
//
//             Effect.catchAll(() => Effect.void)
//             Effect.catchTag("NotFound", () => Effect.void)
//             Effect.catchTags({ NotFound: () => Effect.void })
//
//           The error leaves the type signature and leaves the program at
//           the same time. Effect's whole claim is that failures are in
//           the type, so a handler that returns the unit effect is not
//           handling anything — it is deleting the evidence that the
//           operation failed while the caller reads a success. Every
//           later symptom is then unattributable, because the one frame
//           that knew is the frame that discarded it.
//
//           Three fixes, and the message names them: let the error
//           propagate, map it to an error this layer does declare, or
//           recover with a value the caller can actually use.
//
// Applies:  All .ts and .tsx files EXCEPT test files and scripts.
//
// Error:    "This catch handler returns Effect.void, so the failure
//            leaves the type and the program at once and the caller
//            reads a success. Let the error propagate, map it with
//            Effect.mapError to an error this layer declares, or
//            recover with a real fallback value."
//
// Negative space: A handler passed by reference
//                 (`Effect.catchAll(ignoreFailure)`) is not followed to
//                 its declaration; only an inline handler is read. And a
//                 handler returning `Effect.logError(…)` is the same
//                 swallow at the type level — it also produces
//                 `Effect<void>` — but telling those apart needs types,
//                 which is @effect/language-service's tier, not this one.
//                 See overview.md.
//
// ── Adapt ─────────────────────────────────────────────────────────────
//
// 1. Which combinators count as catching — `CATCH_METHODS`:
//    The three that take a recovery handler. Add `orElse`, `catchIf`, and
//    `catchSome` if the project uses them — they swallow identically —
//    and note that `catchSome` wraps its handler in `Option.some(…)`, so
//    the void test has to look through that call.
//
// 2. What counts as the empty effect — `VOID_EFFECT_MEMBERS` and the
//    `Effect.succeed(undefined)` spelling:
//    `unit` is the pre-3.x name for `void` and is here because old code
//    and old training data both still write it. `Effect.succeed(undefined)`
//    is the same value spelled around the ban.
//
// 3. The one legitimate shape this rule refuses, and what to do with it:
//    idempotent recovery. `Effect.catchTag("NotFound", () => Effect.void)`
//    on a delete is correct — the caller asked for the row to be gone and
//    it is gone, so there is nothing to report and nothing to recover.
//    The rule still fires, because no per-file rule can tell that case
//    from a swallow, and the two are spelled identically.
//
//    Two honest ways out, both of which leave a trace. Return a value
//    that says what happened (`Effect.succeed({ deleted: false })` — the
//    caller then knows, and the type says so), which is usually the
//    better design anyway. Or keep the void and disable the rule on that
//    line with a comment naming the invariant, the way
//    `types/require-safety-comment` makes an assertion justify itself:
//    `rg` over the disables is then the list of every deliberate swallow
//    in the codebase, which is exactly the list worth being able to
//    produce. What must not happen is loosening the rule to allow the
//    shape globally — that trades a greppable exception list for a hole.
//
// 4. Every argument is tested, not the one the arity implies.
//    `Effect.catchAll(effect, handler)` (data-first) and
//    `effect.pipe(Effect.catchAll(handler))` (data-last) put the handler
//    in different positions, and `pipe(effect, Effect.catchAll(handler))`
//    is a third spelling of the second. Reading `arguments[0]` catches
//    one of the three and reports nothing for the others.
//
// 5. Registration:
//    Add the rule to the project's oxlint plugin
//    (`rules: { "no-silent-error-swallow": noSilentErrorSwallowRule }`)
//    and turn it on in `.oxlintrc.json`
//    (`"<plugin>/no-silent-error-swallow": "error"`).
//
// ──────────────────────────────────────────────────────────────────────

import { defineRule, type ESTree } from "@oxlint/plugins";
import { isArchitectureExemptPath } from "../lib/architecture-exempt-paths.ts";

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

export const noSilentErrorSwallowRule = defineRule({
  meta: {
    type: "problem",
    messages: {
      silentErrorSwallow:
        "This catch handler returns Effect.void, so the failure leaves the type and the program at once and the caller reads a success. Let the error propagate, map it with Effect.mapError to an error this layer declares, or recover with a real fallback value.",
    },
  },
  create(context) {
    if (isArchitectureExemptPath(context.filename)) return {};

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
