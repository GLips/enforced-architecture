// ─── structure/schema-placement ─────────────────────────────────────────
//
// Tag:       structure
// Mechanism: oxlint JS plugin (per-file, real-time)
// Blocking:  Yes
//
// Prevents: Database schema declarations (table definitions, relation
//           declarations) placed outside the centralized schema
//           directory. Schema must live in infrastructure/db/schema/
//           because migration tooling scans one directory, foreign keys
//           cross domain boundaries, and ORM relations reference tables
//           from multiple files. Scattering schema across features
//           breaks migration generation and makes the data model
//           impossible to reason about from one location.
//
// Applies:  All src/** files EXCEPT:
//           - infrastructure/db/schema/** (IS the correct location)
//           - Migration directories (drizzle/, migrations/)
//           - Test files and scripts
//
// Error:    "Schema declarations (pgTable, relations) must live in
//            infrastructure/db/schema/*. Move this declaration to the
//            appropriate schema file."
//
// ── Adapt ─────────────────────────────────────────────────────────────
//
// 1. `SCHEMA_DIRECTORY` — where schema IS allowed:
//    Examples:
//      /\/src\/infrastructure\/db\/schema\//  — layered (this template)
//      /\/src\/db\/schema\//                  — flat top-level db directory
//      /\/src\/database\/schema\//            — alternative naming
//    A single schema FILE rather than a directory works too:
//    /\/src\/schema\.ts$/.
//
// 2. `SCHEMA_DECLARATIONS` — the ORM's declaration functions:
//    Examples:
//      pgTable, relations         — Drizzle with PostgreSQL (this template)
//      mysqlTable, relations      — Drizzle with MySQL
//      sqliteTable, relations     — Drizzle with SQLite
//      defineTable                — alternative ORM
//    Add every dialect the project actually uses; a name not in the set
//    is not checked.
//
// 3. `MIGRATION_DIRECTORY` — generated migrations, which legitimately
//    restate the schema:
//    Examples:
//      /\/drizzle\//              — Drizzle default (this template)
//      /\/prisma\/migrations\//   — Prisma migrations
//      /\/migrations\//           — generic migrations directory
//
// 4. Registration:
//    Add the rule to the project's oxlint plugin
//    (`rules: { "schema-placement": schemaPlacementRule }`) and turn it
//    on in `.oxlintrc.json` (`"<plugin>/schema-placement": "error"`).
//
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
