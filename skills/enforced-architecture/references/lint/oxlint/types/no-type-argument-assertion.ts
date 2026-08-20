// ─── types/no-type-argument-assertion ────────────────────────────────
//
// Tag:      types
// Mechanism: oxlint JS plugin (per-file, real-time)
// Blocking: Yes
//
// Prevents: A type argument on a call that fetches or parses external
//           data, where the argument is doing the work of an assertion:
//
//             const user = await response.json<User>();
//             const config = parse<Config>(rawText);
//             const rows = await sql<InvoiceRow>`select * from invoices`;
//
//           Each of these is `as User` wearing respectable clothes.
//           Nothing checked the bytes that came back; the call was told
//           what they are. The difference from a bare assertion is
//           entirely cosmetic — and cosmetic is the whole problem,
//           because it reads as ordinary typed API usage rather than as
//           an override.
//
//           This is a hole in the assertion trio rather than an addition
//           to it. `types/require-safety-comment`,
//           `types/no-chained-type-assertions`, and
//           `types/no-widen-then-assert` all key on `as` expressions and
//           the angle-bracket assertion node, so all three are silent on
//           every line above. An agent that has been refused `as User`
//           three times reaches for this spelling next, and it is the
//           first one that goes green.
//
//           The Effect-SQL-specific spelling of the same idea — where
//           the type argument to `sql` also decides how each column is
//           decoded — lives at `rules/effect/no-sql-type-parameter.ts`.
//           A project on Effect wants both: this rule for the transport
//           calls, that one for the query builder's own richer contract.
//
// Excludes: Type arguments that are not claims about external data —
//           `useState<User>()`, `new Map<string, Invoice>()`,
//           `Schema.decodeUnknown<Invoice>(raw)`. The rule matches a
//           named list of calls, never explicit type arguments as such.
//           `response.json<unknown>()` is also allowed: it asserts
//           nothing, and it is the first half of the fix.
//
// Applies:  All .ts and .tsx files EXCEPT:
//           - Test files and scripts
//
// Error:    "`{{name}}<{{args}}>` asserts that external data is
//            `{{type}}` with nothing checked — `as {{type}}` in a
//            position the assertion rules cannot see. Parse the result
//            at this boundary with a schema and take the type from the
//            parser."
//
// ── Adapt ─────────────────────────────────────────────────────────────
//
// 1. Which calls assert — `ASSERTING_DATA_CALL_NAMES`:
//    The list IS the rule; everything else is plumbing. It ships with
//    the HTTP verbs, `json`, `parse`, the SQL driver methods, and the
//    query tags, which covers fetch, axios/ky, node-postgres, and the
//    `sql`/`gql` template tags. Add the project's own transport wrappers
//    — `fetchJson`, `$fetch`, `rpc`, `invoke` — since a wrapper is
//    exactly where this spelling collects.
//
// 2. Only the last name segment is read, never the receiver:
//    `get` matches `api.get`, `httpClient.get`, and a bare `get(…)`
//    alike, so no project has to enumerate its client variables. The
//    cost is a false positive on a DI container's `container.get<Svc>()`
//    — which is the same unchecked claim, so the rule reports it on
//    purpose, and a project that disagrees drops `get` from the list
//    rather than adding receiver matching.
//
// 3. `unknown` is the escape hatch; `any` deliberately is not.
//    `json<unknown>()` claims nothing and is the honest spelling of "I
//    have not parsed this yet", so it passes. `json<any>()` claims
//    nothing either and still reports, because allowing it would make
//    the cheapest response to this rule the one that also turns off
//    checking downstream.
//
// 4. Wrappers around the callee are stepped through —
//    `TRANSPARENT_CALLEE_WRAPPERS`:
//    `api.get!<User>(url)` and `(client.get as Getter)<User>(url)` are
//    the same call with a node wedged in, and TypeScript hands both over
//    for free. Stepping through them is four lines; not stepping through
//    them is a bypass anyone finds by accident.
//
// 5. A callee behind a binding is not followed:
//    `const runQuery = db.query; runQuery<Row>(sql)` reports only if
//    `runQuery` is itself in the list. Following the binding needs the
//    kind of flow analysis that belongs to `tsc`, not this tier. Named
//    here because the silence is a design decision, not an oversight.
//
// 6. Registration:
//    Add the rule to the project's oxlint plugin
//    (`rules: { "no-type-argument-assertion": noTypeArgumentAssertionRule }`)
//    and turn it on in `.oxlintrc.json`
//    (`"<plugin>/no-type-argument-assertion": "error"`).
//
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
      // See Adapt note 3: the all-`unknown` instantiation is the honest spelling, not an evasion.
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
