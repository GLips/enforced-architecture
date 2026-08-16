// ─── effect/no-sql-type-parameter ─────────────────────────────────────
//
// Tag:       effect
// Mechanism: oxlint JS plugin (per-file, real-time)
// Blocking:  Yes
//
// Prevents: A type parameter on an Effect-SQL template literal —
//
//             const rows = yield* sql<Invoice>`select * from invoices`
//
//           The parameter is an assertion wearing generic syntax. It
//           declares the row shape and checks nothing: the driver hands
//           back whatever the database sent, and every column rename,
//           dropped column, or nullable that the migration introduced is
//           now a lie the compiler will defend. The failure surfaces
//           later, somewhere that reads a field, as `undefined` where
//           the type says `string`.
//
//           `SqlSchema.findOne` / `findAll` / `single` / `void` take a
//           `Schema` and decode the result, so the same shape becomes
//           evidence: a mismatch fails at the query, naming the column,
//           in the effect that ran it.
//
//           The stack-general form of this idea is
//           `types/no-type-argument-assertion`, which refuses the same
//           move wherever a call is *told* what came back —
//           `response.json<User>()`, `parse<Config>(raw)`. That rule and
//           the rest of the `types/` tag are where the general judgement
//           lives; this one is the Effect-SQL spelling, where the type
//           argument also decides how each column is read. A project on
//           Effect wants both.
//
// Applies:  All .ts and .tsx files EXCEPT test files and scripts.
//
// Error:    "A type parameter on a sql template is an assertion: it
//            declares the row shape and nothing checks it, so a renamed
//            column stays a compile-time success and fails downstream.
//            Run the query through SqlSchema.findOne / findAll / single /
//            void with a Schema, and let the decode fail at the query."
//
// Negative space: An untyped `sql` template is left alone. It returns
//                 rows the caller still has to narrow, which is honest —
//                 the defect this rule names is the *claim*, not the
//                 query.
//
// ── Adapt ─────────────────────────────────────────────────────────────
//
// 1. Which tags are SQL tags — `SQL_TAG_NAMES`:
//    Matched against both the base identifier and the final member of
//    the tag, so `sql<T>`, `db.sql<T>`, `this.sql<T>`, and
//    `sql.unsafe<T>` all report. Add the project's own name if the
//    client is bound as something else (`query`, `pg`) — and keep the
//    set small, since any tagged template whose name matches will be
//    read as a query.
//
// 2. Other tagged templates are untouched.
//    A `gql<Data>` or `css<Props>` tag is a different API with different
//    evidence behind it, and this rule takes no position on those.
//
// 3. Adopting `types/no-type-argument-assertion` alongside this rule
//    double-reports every typed query — `sql` is in that rule's name set
//    too. Take both and drop `"sql"` from its
//    `ASSERTING_DATA_CALL_NAMES`, so each line raises the diagnostic
//    whose message names the fix the project actually wants: `SqlSchema`
//    here, a parse at the boundary there.
//
// 4. Registration:
//    Add the rule to the project's oxlint plugin
//    (`rules: { "no-sql-type-parameter": noSqlTypeParameterRule }`) and
//    turn it on in `.oxlintrc.json`
//    (`"<plugin>/no-sql-type-parameter": "error"`).
//
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
