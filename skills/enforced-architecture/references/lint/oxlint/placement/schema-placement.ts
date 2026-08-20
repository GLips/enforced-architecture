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
// ──────────────────────────────────────────────────────────────────────

import { defineRule } from "@oxlint/plugins";
import { isArchitectureExemptPath } from "../lib/architecture-exempt-paths.ts";

const SCHEMA_DECLARATIONS = new Set(["pgTable", "relations"]);

// Both anchored on their enclosing slashes, so a sibling that merely shares a prefix — a
// `schema-archive/` holding retired tables, a `drizzle-helpers/` of query utilities — is still
// governed. Only the real schema directory and the real migration output are exempt.
const SCHEMA_DIRECTORY = /\/src\/infrastructure\/db\/schema\//;
const MIGRATION_DIRECTORY = /\/drizzle\//;

export const schemaPlacementRule = defineRule({
  meta: {
    type: "problem",
    messages: {
      schemaOutsideSchemaDirectory:
        "Schema declarations (pgTable, relations) must live in infrastructure/db/schema/*. Move this declaration to the appropriate schema file.",
    },
  },
  create(context) {
    const { filename } = context;
    if (SCHEMA_DIRECTORY.test(filename) || MIGRATION_DIRECTORY.test(filename)) return {};
    if (isArchitectureExemptPath(filename)) return {};

    return {
      // The declaration is a CALL, wherever it sits: a visitor reaches one nested in a factory or an
      // object literal on the same terms as a top-level `export const`. Matching the bare callee is
      // what keeps `queryBuilder.relations(...)` — an unrelated method that shares the name — out.
      CallExpression(node) {
        if (node.callee.type === "Identifier" && SCHEMA_DECLARATIONS.has(node.callee.name)) {
          context.report({ node, messageId: "schemaOutsideSchemaDirectory" });
        }
      },
    };
  },
});
