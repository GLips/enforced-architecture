// ─── types/no-type-argument-assertion ────────────────────────────────
//
// Makes sure: A call that reads external data does not name the result type
// itself. Not `response.json<User>()`, not `parse<Config>(text)`, not a
// `gql<Data>` tagged template, and not the deferred form
// `const load = client.get<User>`. The type comes from a parser, so a response
// that lost a field fails at the parse with a message, and not later at a read
// of `undefined`.
//
// The list `ASSERTING_DATA_CALL_NAMES` IS the rule; the other code only finds
// the name. It ships with the HTTP verbs, `json`, `parse`, the SQL driver
// methods and the GraphQL tags. Add the project's own transport wrappers —
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
//
// NEGATIVE SPACE: `sql` is deliberately not in the list, and adding it is the
// one edit this rule's spec refuses. `effect/no-sql-type-parameter` owns the
// typed query and says more about it — it names the `SqlSchema` decode as the
// fix and reads both ends of the tag, so it takes `sql.unsafe<Row>`, which the
// last-segment match here never would. Holding the name in both places would
// report one query twice under two different fixes. That rule takes the tag and
// the deferred `const q = sql<Row>` with it; what neither rule reports is a
// `sql` CALL, because on a call the type argument has an honest second reading
// — see the negative space there for why.
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
import { withoutTransparentWrappers } from "../lib/transparent-wrappers.ts";
import { type ESTree } from "@oxlint/plugins";

// Matched against the LAST segment of the callee, so the receiver never has to be enumerated. Every
// name here reads external bytes: the HTTP verbs (axios, ky, ofetch and every wrapper of them),
// `json` for a Response body, `parse` for text formats, the SQL driver methods, and the GraphQL
// tags. `all` is absent on purpose despite `db.all<Row>()`: it would take `Promise.all<[A, B]>`
// with it, and that type argument is a real annotation rather than a claim about data. `sql` is
// absent for a different reason — it has an owner, and the header says which.
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
]);

// Both spellings of the member access, plus the bare call. `client["get"]<User>(url)` is the one a
// rule reading only `property.name` misses, and it is a single keystroke from the plain form.
//
// A callee can be wrapped too: `api.get!<User>(url)` and `(api.get as Getter)<User>(url)` are the
// same call with a node wedged between it and its callee, and either one beats a matcher reading
// `callee` directly. `lib/transparent-wrappers.ts` owns which nodes those are — a wrapped callee
// and a wrapped value are one question, and this rule holding its own list of the answer is how
// the two drift. Its NEGATIVE SPACE note carries the `ParenthesizedExpression` reasoning; the
// parenthesized call in the spec below reports through the plain path either way.
function calledName(expression: ESTree.Expression): string | null {
  const callee = withoutTransparentWrappers(expression);
  if (callee.type === "Identifier") return callee.name;
  if (callee.type !== "MemberExpression") return null;
  if (callee.computed) {
    return callee.property.type === "Literal" && typeof callee.property.value === "string"
      ? callee.property.value
      : null;
  }
  return callee.property.type === "Identifier" ? callee.property.name : null;
}

export const noTypeArgumentAssertionRule = defineTreeRule({
  meta: {
    type: "problem",
    messages: {
      typeArgumentAssertion:
        "`{{name}}<{{args}}>` asserts that external data is `{{type}}` with nothing checked — `as {{type}}` in a position the assertion rules cannot see. Parse the result at this boundary with a schema and take the type from the parser.",
    },
  },
  create(context) {

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

      // `gql<Data>`query …`` is the same assertion with the argument list moved off the call. A
      // rule that visits only CallExpression is silent on every tagged-template query builder
      // there is.
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
