// ─── effect/no-sql-type-parameter ─────────────────────────────────────
//
// Makes sure: No `sql` template states a row shape that nothing checks —
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
// `types/no-type-argument-assertion` holds `sql` in its call-name set, so
// both rules together report every typed query twice. Take both and remove
// `"sql"` from that rule's `ASSERTING_DATA_CALL_NAMES`. Each line then
// carries the message that names the fix its own tag asks for.
// ──────────────────────────────────────────────────────────────────────

import { defineRule, type ESTree } from "@oxlint/plugins";
import { isArchitectureExemptPath } from "../lib/architecture-exempt-paths.ts";

const SQL_TAG_NAMES = new Set(["sql"]);

/** The property name when it is statically known — `x.name` or `x["name"]`, never `x[expr]`. */
function staticPropertyName(node: ESTree.MemberExpression): string | null {
  if (!node.computed) return node.property.type === "Identifier" ? node.property.name : null;
  return node.property.type === "Literal" && typeof node.property.value === "string"
    ? node.property.value
    : null;
}

/**
 * Both ends of the tag are tested because the client shows up at either: `db.sql` puts the name
 * last, and `sql.unsafe` puts it first. A rule reading one end misses whichever spelling the
 * project settled on — and `sql.unsafe<Row>` is the one that most wants catching, since it has
 * neither validation nor escaping.
 */
function isSqlTag(tag: ESTree.Expression): boolean {
  if (tag.type === "Identifier") return SQL_TAG_NAMES.has(tag.name);
  if (tag.type !== "MemberExpression") return false;
  const member = staticPropertyName(tag);
  if (member !== null && SQL_TAG_NAMES.has(member)) return true;
  return isSqlTag(tag.object);
}

export const noSqlTypeParameterRule = defineRule({
  meta: {
    type: "problem",
    messages: {
      sqlTypeParameter:
        "A type parameter on a sql template is an assertion: it declares the row shape and nothing checks it, so a renamed column stays a compile-time success and fails downstream. Run the query through SqlSchema.findOne / findAll / single / void with a Schema, and let the decode fail at the query.",
    },
  },
  create(context) {
    if (isArchitectureExemptPath(context.filename)) return {};

    return {
      TaggedTemplateExpression(node) {
        if (node.typeArguments === null || node.typeArguments === undefined) return;
        if (isSqlTag(node.tag)) {
          context.report({ node, messageId: "sqlTypeParameter" });
        }
      },
    };
  },
});
