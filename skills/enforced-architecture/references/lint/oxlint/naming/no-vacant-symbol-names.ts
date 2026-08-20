// ─── naming/no-vacant-symbol-names ───────────────────────────────────
//
// Makes sure: Every name another file can reach — a type, and a function, class
// or constant at module level — says what the thing is for. One search for
// `UserRow` or for `CreateUserInput` gives you the declaration and each use of
// it. You do not open six files to learn which type named `UserData` is the
// database row and which one is the form input.
//
// The rule visits declarations, not references. A version that visits every
// `Identifier` reports an imported third-party name, `DataGrid` for example.
// That name is not the project's to change, so the rule gets disabled.
//
// Object properties are not checked. An external payload dictates `{ data: … }`
// and the project cannot rename it. Add `TSPropertySignature` and
// `PropertyDefinition` to the visitors only in a project that owns its payload
// names.
//
// Keep `base`, `item` and `value` out of `VACANT_TERMS`. Each is exact in its
// place: a base component, and a member of a generic container. `data` is the
// entry that reports most often, and thus the first one to remove if the
// project cannot adopt the whole list at once.
// ──────────────────────────────────────────────────────────────────────

import { defineTreeRule } from "../lib/define-tree-rule.ts";
import { type ESTree } from "@oxlint/plugins";

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

export const noVacantSymbolNamesRule = defineTreeRule({
  meta: {
    type: "problem",
    messages: {
      vacantName:
        "`{{name}}` is named for what kind of thing it is, not what it is for — every type is a shape, every value is data. Name the role: which layer owns this representation and what it is used for (`UserRow`, `CreateUserInput`, `UserResponse`).",
    },
  },
  create(context) {

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
