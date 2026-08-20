// ─── placement/schema-placement ─────────────────────────────────────────
//
// Makes sure: Every pgTable and relations declaration sits in
// infrastructure/db/schema/. The migration tool reads that one directory, thus
// a generate run covers every table and no column the code expects is absent
// from the database. You read the whole data model, foreign keys and relations
// included, at one address.
//
// Generated migrations restate the schema, and /drizzle/ is exempt for that
// reason. Remove the exemption and every generated file reports. A report
// against generated output is what makes a person turn the rule off.
//
// SCHEMA_DECLARATIONS is a closed set of names. A dialect outside it —
// `mysqlTable` in a project that also uses postgres — gets no check, and its
// tables pass at any address. Add every dialect the project uses on the day of
// adoption.
//
// The rule reports the call and not the export. A declaration nested in a
// factory or in an object literal is a table all the same, and it gets the same
// report as a top-level `export const`.
//
// A table at the right address says nothing about who may query it. That is
// boundary/db-isolation's finding.
//
// SCOPE, and it is the same for every rule in this catalog: this rule is silent
// outside the declared trees, and silent on the files `isArchitectureExemptPath`
// names inside them — tests, scripts, generated and ambient modules. Neither
// silence is coverage. `lib/define-tree-rule.ts` owns both, which is why no rule
// body checks either one.
// ──────────────────────────────────────────────────────────────────────

import { defineTreeRule } from "../lib/define-tree-rule.ts";
import {
  isUnderPath,
  dbSchemaPath,
} from "../../policy/layout.ts";

const SCHEMA_DECLARATIONS = new Set(["pgTable", "relations"]);

export const schemaPlacementRule = defineTreeRule({
  meta: {
    type: "problem",
    messages: {
      schemaOutsideSchemaDirectory:
        "Schema declarations (pgTable, relations) must live in {{schemaDir}}/*. Move this declaration to the appropriate schema file.",
    },
  },
  create(context, role) {
    // Generated migration output sits outside every declared tree, so this rule
    // is already silent there and needs no exemption of its own. The same is
    // true of a monorepo package that IS the schema package and declares its own
    // tree: it names its schema directory in that tree's `dbSchemaPath`, and the
    // rule reads that rather than prescribing a directory the package does not
    // have.
    // Whole segments, so a sibling that merely shares a prefix — a
    // `schema-archive/` holding retired tables, a `drizzle-helpers/` of query
    // utilities — is still governed.
    if (isUnderPath(role.sourcePath, dbSchemaPath(role.tree.vocabulary))) return {};

    return {
      // The declaration is a CALL, wherever it sits: a visitor reaches one nested in a factory or an
      // object literal on the same terms as a top-level `export const`. Matching the bare callee is
      // what keeps `queryBuilder.relations(...)` — an unrelated method that shares the name — out.
      CallExpression(node) {
        if (node.callee.type === "Identifier" && SCHEMA_DECLARATIONS.has(node.callee.name)) {
          context.report({
            node,
            messageId: "schemaOutsideSchemaDirectory",
            // The tree's own path. A destination spelled into the message is a
            // prescription a renamed tree cannot follow — the directory it
            // names does not exist there.
            data: { schemaDir: dbSchemaPath(role.tree.vocabulary) },
          });
        }
      },
    };
  },
});
