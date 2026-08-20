// ─── naming/no-vacant-symbol-names ───────────────────────────────────
//
// Tag:      naming
// Mechanism: oxlint JS plugin (per-file, real-time)
// Blocking: Yes
//
// Prevents: Declarations named after the CATEGORY of thing they are
//           rather than the role they play:
//
//             interface UserShape { … }
//             type UserData = { … }
//             const invoiceInfo = …
//             class BillingManager { … }
//
//           Every interface is a shape. Every type is data. The word
//           adds nothing a reader did not already know from the
//           declaration keyword, so the name carries exactly as much
//           information as `User` would have — while looking like it
//           carries more.
//
//           The reason these appear is worth naming, because it decides
//           the fix. You reach for `UserShape` at the moment you need a
//           SECOND type for a concept you already have a name for: the
//           database row, the form input, the API response, the draft.
//           The names that record that decision are `UserRow`,
//           `CreateUserInput`, `UserResponse`, `UserDraft` — each one
//           says which layer owns that representation. `UserShape` says
//           only that you needed another type and did not want to
//           choose. It is `Record<string, unknown>` in the name rather
//           than in the type.
//
//           That makes this the naming-side counterpart to the
//           `boundary` and `api` tags: those keep layers apart in the
//           import graph, and this keeps the layer visible in the name
//           an agent greps for.
//
// Excludes: Words that merely CONTAIN a banned term. Matching is on
//           whole words after splitting camelCase, PascalCase and
//           snake_case, so `reshape`, `metadata`, and `database` are
//           untouched. Substring matching is what makes this kind of
//           rule unusable.
//
//           Local bindings inside function bodies. A `const data` two
//           lines from its use is not an address anyone searches for.
//
// Applies:  All .ts and .tsx files EXCEPT:
//           - Test files and scripts
//
// Error:    "`{{name}}` is named for what kind of thing it is, not what
//            it is for — every type is a shape, every value is data.
//            Name the role: which layer owns this representation and
//            what it is used for (`UserRow`, `CreateUserInput`,
//            `UserResponse`)."
//
// ── Adapt ─────────────────────────────────────────────────────────────
//
// 1. The list — `VACANT_TERMS`. This is the whole rule; edit it freely.
//    `data` is by far the highest-volume entry and the first one to cut
//    if the rule is too loud to adopt — `formData` and `chartData` are
//    idiomatic in many codebases even though the argument above applies
//    to them. `manager` and `helper` are the safest to keep: a class
//    named for managing something almost always has no boundary.
//    Deliberately NOT included: `base`, which carries real meaning in a
//    component hierarchy, and `item`/`value`, which are correct inside
//    generic containers.
//
// 2. What is checked — declarations, not references:
//    Type declarations report wherever they appear; functions, classes
//    and variables report only at module top level. A rule visiting
//    every `Identifier` also reports on imported third-party names
//    (`import { DataGrid } from "…"`), which cannot be fixed and
//    guarantees the rule gets turned off.
//
// 3. Object properties are not checked:
//    `{ data: … }` on a response payload is often dictated by an
//    external API. Add `TSPropertySignature` and `PropertyDefinition`
//    to the visitors if the project owns its payload names.
//
// 4. Registration:
//    Add the rule to the project's oxlint plugin
//    (`rules: { "no-vacant-symbol-names": noVacantSymbolNamesRule }`)
//    and turn it on in `.oxlintrc.json`
//    (`"<plugin>/no-vacant-symbol-names": "error"`).
//
// ──────────────────────────────────────────────────────────────────────

import { defineRule, type ESTree } from "@oxlint/plugins";
import { isArchitectureExemptPath } from "../lib/architecture-exempt-paths.ts";

const VACANT_TERMS = new Set([
  "data",
  "helper",
  "helpers",
  "info",
  "manager",
  "object",
  "shape",
  "stuff",
  "thing",
  "util",
  "utils",
]);

// Whole-word matching after splitting the identifier. The upstream rule this generalises uses a
// case-insensitive substring test, which flags `reshape`, `metadata`, and `database` — three
// false positives that would each read as the rule being broken rather than the name being bad.
function identifierWords(name: string): string[] {
  return name
    .replace(/([a-z0-9])([A-Z])/gu, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/gu, "$1 $2")
    .split(/[\s_]+/u)
    .filter((word) => word.length > 0)
    .map((word) => word.toLowerCase());
}

function vacantTerm(name: string): string | null {
  return identifierWords(name).find((word) => VACANT_TERMS.has(word)) ?? null;
}

// A declaration is an "address" when something outside its own block can reach it by name. Locals
// inside a function body are excluded: they are read in the same screenful that declares them.
function isModuleLevel(node: ESTree.Node): boolean {
  let current: ESTree.Node | null = node.parent;
  while (current !== null) {
    if (current.type === "Program") return true;
    if (
      current.type === "VariableDeclaration" ||
      current.type === "ExportNamedDeclaration" ||
      current.type === "ExportDefaultDeclaration"
    ) {
      current = current.parent;
      continue;
    }
    return false;
  }
  return false;
}

export const noVacantSymbolNamesRule = defineRule({
  meta: {
    type: "problem",
    messages: {
      vacantName:
        "`{{name}}` is named for what kind of thing it is, not what it is for — every type is a shape, every value is data. Name the role: which layer owns this representation and what it is used for (`UserRow`, `CreateUserInput`, `UserResponse`).",
    },
  },
  create(context) {
    if (isArchitectureExemptPath(context.filename)) return {};

    const report = (identifier: ESTree.Node & { name: string }) => {
      if (vacantTerm(identifier.name) === null) return;
      context.report({
        node: identifier,
        messageId: "vacantName",
        data: { name: identifier.name },
      });
    };

    // Named by the three node types rather than by a structural `{ id }`, because a visitor
    // handler has to accept the AST's node union: a shape that only some nodes satisfy is not
    // assignable to the visitor slot, whichever three nodes actually reach it.
    const reportNamedDeclaration = (
      node:
        | ESTree.TSTypeAliasDeclaration
        | ESTree.TSInterfaceDeclaration
        | ESTree.TSEnumDeclaration,
    ) => {
      report(node.id);
    };

    // Types report wherever they are declared: a type name is an address even inside a namespace,
    // and there is no "local type" the way there is a local variable.
    return {
      TSTypeAliasDeclaration: reportNamedDeclaration,
      TSInterfaceDeclaration: reportNamedDeclaration,
      TSEnumDeclaration: reportNamedDeclaration,

      FunctionDeclaration(node) {
        if (node.id !== null && isModuleLevel(node)) report(node.id);
      },
      ClassDeclaration(node) {
        if (node.id !== null && isModuleLevel(node)) report(node.id);
      },
      VariableDeclarator(node) {
        if (node.id.type === "Identifier" && isModuleLevel(node)) report(node.id);
      },
    };
  },
});
