// ─── types/no-type-argument-assertion ────────────────────────────────
//
// Makes sure: A call that reads external data does not name the result type
// itself. Not `response.json<User>()`, not `parse<Config>(text)`, not a
// `sql<Row>` tagged template, and not the deferred form
// `const load = client.get<User>`. The type comes from a parser, so a response
// that lost a field fails at the parse with a message, and not later at a read
// of `undefined`.
//
// The list `ASSERTING_DATA_CALL_NAMES` IS the rule; the other code only finds
// the name. It ships with the HTTP verbs, `json`, `parse`, the SQL driver
// methods and the query tags. Add the project's own transport wrappers —
// `fetchJson`, `$fetch`, `rpc`, `invoke` — because a wrapper is where this
// spelling appears most.
//
// Only the last name segment is read, never the receiver. `container.get<Svc>()`
// therefore reports, because it is the same unchecked claim. A project that
// disagrees drops `get` from the list instead of a match on the receiver.
//
// `json<unknown>()` passes and `json<any>()` reports. The first claims nothing
// and is the first half of the fix. If you allow the second, the cheapest
// answer to this rule also stops the checks downstream.
//
// A callee behind a binding is not followed: `const runQuery = db.query;
// runQuery<Row>(sql)` reports only if `runQuery` is in the list, by design.
// ──────────────────────────────────────────────────────────────────────

import { defineRule, type ESTree } from "@oxlint/plugins";
import { isArchitectureExemptPath } from "../lib/architecture-exempt-paths.ts";

// Matched against the LAST segment of the callee, so the receiver never has to be enumerated. Every
// name here reads external bytes: the HTTP verbs (axios, ky, ofetch and every wrapper of them),
// `json` for a Response body, `parse` for text formats, the SQL driver methods, and the query tags.
// `all` is absent on purpose despite `db.all<Row>()`: it would take `Promise.all<[A, B]>` with it,
// and that type argument is a real annotation rather than a claim about data.
const ASSERTING_DATA_CALL_NAMES = new Set([
  "delete",
  "execute",
  "fetch",
  "get",
  "gql",
  "graphql",
  "json",
  "parse",
  "patch",
  "post",
  "put",
  "query",
  "request",
  "sql",
]);

// `api.get!<User>(url)` and `(api.get as Getter)<User>(url)` are the same call with a node wedged
// between it and its callee, and either one beats a matcher that reads `callee` directly.
// `boundary/ambient-globals` carries the same set for the same reason. `ParenthesizedExpression` is
// listed although oxlint 1.77.0 does not surface it — the spec pins the parenthesized call as
// reporting, so this stays correct whichever way a future version parses it.
const TRANSPARENT_CALLEE_WRAPPERS = new Set([
  "ChainExpression",
  "ParenthesizedExpression",
  "TSAsExpression",
  "TSNonNullExpression",
  "TSSatisfiesExpression",
  "TSTypeAssertion",
]);

// Both spellings of the member access, plus the bare call. `client["get"]<User>(url)` is the one a
// rule reading only `property.name` misses, and it is a single keystroke from the plain form.
function calledName(expression: ESTree.Expression): string | null {
  let callee = expression;
  while (TRANSPARENT_CALLEE_WRAPPERS.has(callee.type) && "expression" in callee) {
    callee = callee.expression as ESTree.Expression;
  }
  if (callee.type === "Identifier") return callee.name;
  if (callee.type !== "MemberExpression") return null;
  if (callee.computed) {
    return callee.property.type === "Literal" && typeof callee.property.value === "string"
      ? callee.property.value
      : null;
  }
  return callee.property.type === "Identifier" ? callee.property.name : null;
}

export const noTypeArgumentAssertionRule = defineRule({
  meta: {
    type: "problem",
    messages: {
      typeArgumentAssertion:
        "`{{name}}<{{args}}>` asserts that external data is `{{type}}` with nothing checked — `as {{type}}` in a position the assertion rules cannot see. Parse the result at this boundary with a schema and take the type from the parser.",
    },
  },
  create(context) {
    if (isArchitectureExemptPath(context.filename)) return {};

    const sourceCode = context.sourceCode;

    function checkTypeArguments(
      callee: ESTree.Expression,
      typeArguments: ESTree.TSTypeParameterInstantiation | null | undefined,
    ): void {
      if (typeArguments === null || typeArguments === undefined) return;
      const params = typeArguments.params;
      if (params.length === 0) return;

      const name = calledName(callee);
      if (name === null || !ASSERTING_DATA_CALL_NAMES.has(name)) return;
      // The all-`unknown` instantiation is the honest spelling, not an evasion.
      if (params.every((param) => param.type === "TSUnknownKeyword")) return;

      const args = params.map((param) => sourceCode.getText(param));
      context.report({
        // Reported on the type arguments rather than the call: the span then covers exactly the
        // text that has to go, and a call that is otherwise fine does not read as banned.
        node: typeArguments,
        messageId: "typeArgumentAssertion",
        data: { name, args: args.join(", "), type: args[0] ?? "" },
      });
    }

    return {
      CallExpression(node) {
        checkTypeArguments(node.callee, node.typeArguments);
      },

      // `sql<Row>`select …`` is the same assertion with the argument list moved off the call. A rule
      // that visits only CallExpression is silent on every tagged-template query builder there is.
      TaggedTemplateExpression(node) {
        checkTypeArguments(node.tag, node.typeArguments);
      },

      // The instantiation expression — `const loadUser = client.get<User>` — defers the call by one
      // line and keeps the claim. It is a separate node from CallExpression, so it survives a rule
      // built only around calls, and it is the shape that appears once the call form is refused.
      TSInstantiationExpression(node) {
        checkTypeArguments(node.expression, node.typeArguments);
      },
    };
  },
});
