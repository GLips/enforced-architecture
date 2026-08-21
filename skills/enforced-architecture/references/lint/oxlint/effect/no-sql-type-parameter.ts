// ─── effect/no-sql-type-parameter ─────────────────────────────────────
//
// Makes sure: No `sql` tag states a row shape that nothing checks —
// `sql<Row>`, `db.sql<Row>`, and `sql.unsafe<Row>` all report. A typed row
// comes from a `SqlSchema` decode, so a renamed column fails at the query
// and the message names the column. You stop the search for an `undefined`
// three frames away, on a field the type calls a `string`.
//
// Keep `SQL_TAG_NAMES` small. The set is matched against both the base
// identifier and the final member of the tag, so a common name (`query`,
// `db`) turns every tagged template with that name into a query.
//
// An untyped `sql` template gets no finding. It returns rows the caller
// must narrow, which is honest — the defect this rule names is the claim,
// not the query.
//
// This rule is the sole owner of the typed `sql` name. `sql` is deliberately
// absent from `types/no-type-argument-assertion`'s call-name set, which means a
// spelling missed here is missed everywhere rather than picked up by that rule.
// The deferred form `const typedSql = sql<Row>` is covered for that reason: it
// is the shape that appears once the template form starts being refused, and
// the template it later tags carries no type argument to report.
//
// NEGATIVE SPACE: a `sql` CALL is not the subject, so `sql<Row>(query)` and
// `sql.unsafe<Row>(query)` get no finding from either rule. This is a judgement
// and not an oversight — on a call the type argument is genuinely ambiguous.
// `sql.begin<T>(cb)` and `sql.reserve<T>()` take one as a real annotation of
// what the callback returns, and reporting those buys a rule people switch off.
// A template and a bare instantiation have no such second reading.
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
import { withoutTransparentWrappers } from "../lib/transparent-wrappers.ts";
import { type ESTree } from "@oxlint/plugins";

const SQL_TAG_NAMES = new Set(["sql"]);

/**
 * Both ends of the tag are tested because the client shows up at either: `db.sql` puts the name
 * last, and `sql.unsafe` puts it first. A rule reading one end misses whichever spelling the
 * project settled on — and `sql.unsafe<Row>` is the one that most wants catching, since it has
 * neither validation nor escaping.
 *
 * The wrappers come off at BOTH ends, because a tag is a value and either end of it can be
 * wrapped: `sql!<Row>` wedges a node at the top, `(sql as Client).unsafe<Row>` wedges one under
 * the member the recursion has to walk through. TypeScript syntax hands both bypasses over for
 * free while the source still reads `sql`. This rule is the only owner of the name, so a wrapper
 * it does not step through is a hole nothing else covers.
 */
function isSqlTag(tag: ESTree.Node): boolean {
  const bare = withoutTransparentWrappers(tag);
  if (bare.type === "Identifier") return SQL_TAG_NAMES.has(bare.name);
  if (bare.type !== "MemberExpression") return false;
  const member = staticKeyName(bare.property, bare.computed);
  if (member !== undefined && SQL_TAG_NAMES.has(member)) return true;
  return isSqlTag(bare.object);
}

export const noSqlTypeParameterRule = defineTreeRule({
  meta: {
    type: "problem",
    messages: {
      sqlTypeParameter:
        "A type parameter on a sql tag is an assertion: it declares the row shape and nothing checks it, so a renamed column stays a compile-time success and fails downstream. Run the query through SqlSchema.findOne / findAll / single / void with a Schema, and let the decode fail at the query.",
    },
  },
  create(context) {

    function reportTypedSqlTag(
      node: ESTree.Node,
      tag: ESTree.Node,
      typeArguments: ESTree.TSTypeParameterInstantiation | null | undefined,
    ): void {
      if (typeArguments === null || typeArguments === undefined) return;
      if (!isSqlTag(tag)) return;
      context.report({ node, messageId: "sqlTypeParameter" });
    }

    return {
      TaggedTemplateExpression(node) {
        reportTypedSqlTag(node, node.tag, node.typeArguments);
      },

      // `const typedSql = sql<Row>` moves the type argument off the template and keeps the claim
      // whole: the tagged template written later carries no type argument, so a rule visiting only
      // TaggedTemplateExpression sees an honest untyped query and the assertion travels on the
      // binding. It is a separate node type, which is exactly why it survives.
      TSInstantiationExpression(node) {
        reportTypedSqlTag(node, node.expression, node.typeArguments);
      },
    };
  },
});
