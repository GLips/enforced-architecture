// ─── placement/no-plain-export-in-server-fn-module ────────────────────
//
// Makes sure: A module that defines createServerFn or createMiddleware exports
// the bridges and the types only, and each bridge has a name. The client
// compiler replaces the handler body but leaves a sibling runtime export in
// place, thus that export and every module it imports reach the browser. You
// import such a module from a client component and you do not first read what
// else the file exports.
//
// The bridge exemption reads the initializer's call chain. Do not test for the
// factory name anywhere inside the initializer:
// `export const helper = () => createServerFn()` then passes, and it puts a
// real function on the client.
//
// A bridge counts in the inline `export const name = createServerFn(…)`
// spelling alone. A later `export { name }` clause gives the rule no
// initializer to read, so it reports. The compiler needs the inline spelling
// too: it resolves a server fn through its variable declarator and throws
// "createServerFn must be assigned to a variable!" otherwise. That is why
// `export default createServerFn(…)` has a message of its own.
//
// `enum` and `namespace` are absent from TYPE_ONLY_DECLARATIONS on purpose:
// both emit a runtime object, so both reach the browser.
//
// The rule reads one file. It does not prove that the client reaches this
// module; the boundary/ graph checks answer that. The compiler behaviour is in
// @tanstack/start-plugin-core/src/start-compiler/handleCreateServerFn.ts.
// ──────────────────────────────────────────────────────────────────────

import { defineTreeRule } from "../lib/define-tree-rule.ts";
import { type ESTree } from "@oxlint/plugins";
import { isServerModule } from "../../policy/layout.ts";

const COMPILER_BRIDGE_FACTORIES = new Set(["createServerFn", "createMiddleware"]);
const TYPE_ONLY_DECLARATIONS = new Set([
  "TSTypeAliasDeclaration",
  "TSInterfaceDeclaration",
  "TSDeclareFunction",
]);

type LeakMessageId = "runtimeExportLeak" | "defaultBridgeExport";

function unwrapTypeWrappers(expression: ESTree.Expression): ESTree.Expression {
  let cursor = expression;
  while (
    cursor.type === "TSAsExpression" ||
    cursor.type === "TSSatisfiesExpression" ||
    cursor.type === "TSNonNullExpression" ||
    cursor.type === "TSTypeAssertion"
  ) {
    cursor = cursor.expression;
  }
  return cursor;
}

/** Whether this expression IS a bridge chain — `createServerFn(…).validator(…).handler(…)`. */
function isCompilerBridgeChain(expression: ESTree.Expression): boolean {
  let cursor = unwrapTypeWrappers(expression);

  while (cursor.type === "CallExpression") {
    const callee = unwrapTypeWrappers(cursor.callee);
    if (callee.type === "Identifier") return COMPILER_BRIDGE_FACTORIES.has(callee.name);
    if (callee.type !== "MemberExpression" || callee.computed) return false;
    cursor = unwrapTypeWrappers(callee.object);
  }
  return false;
}

export const noPlainExportInServerFnModuleRule = defineTreeRule({
  meta: {
    type: "problem",
    messages: {
      runtimeExportLeak:
        "Only createServerFn/createMiddleware bridges and types may be exported from a compiler-processed module. Move this runtime export to a client-safe or .server.ts sibling.",
      defaultBridgeExport:
        "A createServerFn/createMiddleware bridge must be assigned to a named const — the compiler resolves it through its variable declarator. Change `export default createServerFn(…)` to `export const <name> = createServerFn(…)`.",
    },
  },
  create(context, role) {
    if (isServerModule(role.tree.vocabulary, role.sourcePath)) return {};

    // Nothing can be judged during the walk. Whether this is a bridge module at all is only settled
    // once the whole file has been seen — the first export is visited long before a bridge call
    // further down the file. So the visitors only collect, and `Program:exit` decides.
    let definesCompilerBridge = false;
    const exports: (
      | ESTree.ExportNamedDeclaration
      | ESTree.ExportDefaultDeclaration
      | ESTree.ExportAllDeclaration
    )[] = [];

    function classifyExport(node: (typeof exports)[number]): LeakMessageId | null {
      if (node.type === "ExportAllDeclaration") {
        // `export * from "…"` is a pure runtime re-export with no shape that could be a bridge.
        return node.exportKind === "type" ? null : "runtimeExportLeak";
      }

      if (node.type === "ExportDefaultDeclaration") {
        const { declaration } = node;
        // Deliberately the same verdict as the `TSInterfaceDeclaration` entry in
        // `TYPE_ONLY_DECLARATIONS` on the next line, spelled out because `Set<string>.has` narrows
        // nothing: an interface is the one default-export kind that is not an expression, and
        // without this the bridge test at the end of the branch has no declaration it can walk.
        // The two move together — dropping the set entry must drop this line as well, or the two
        // spellings of one construct start disagreeing.
        if (declaration.type === "TSInterfaceDeclaration") return null;
        if (TYPE_ONLY_DECLARATIONS.has(declaration.type)) return null;
        if (
          declaration.type === "FunctionDeclaration" ||
          declaration.type === "ClassDeclaration"
        ) {
          return "runtimeExportLeak";
        }
        return isCompilerBridgeChain(declaration) ? "defaultBridgeExport" : "runtimeExportLeak";
      }

      if (node.exportKind === "type") return null;
      const { declaration } = node;

      if (declaration === null) {
        // `export { a }` / `export { a } from "…"`. An inline `export { type Foo }` specifier is
        // erased, so a clause leaks only if it carries at least one value specifier.
        return node.specifiers.some((specifier) => specifier.exportKind !== "type")
          ? "runtimeExportLeak"
          : null;
      }

      if (TYPE_ONLY_DECLARATIONS.has(declaration.type)) return null;

      if (declaration.type === "VariableDeclaration") {
        // `let`/`var` leak even when initialized by a bridge chain: a mutable binding can be
        // reassigned to anything, so the bridge-only guarantee would hold at the declaration and
        // nowhere after it. `every` is what catches a leak riding in a second declarator.
        const isBridgeOnly =
          declaration.kind === "const" &&
          declaration.declarations.every(
            (declarator) => declarator.init !== null && isCompilerBridgeChain(declarator.init),
          );
        return isBridgeOnly ? null : "runtimeExportLeak";
      }

      // Everything left declares runtime: function, class, enum, namespace.
      return "runtimeExportLeak";
    }

    return {
      CallExpression(node) {
        const { callee } = node;
        if (callee.type === "Identifier" && COMPILER_BRIDGE_FACTORIES.has(callee.name)) {
          definesCompilerBridge = true;
        }
      },
      ExportNamedDeclaration(node) {
        exports.push(node);
      },
      ExportDefaultDeclaration(node) {
        exports.push(node);
      },
      ExportAllDeclaration(node) {
        exports.push(node);
      },

      // Deliberately unhandled: `export = x`. It is CommonJS-only and cannot appear in a module
      // that also uses ESM `export const` for its bridges, so there is nothing here to catch.

      "Program:exit"() {
        if (!definesCompilerBridge) return;
        for (const node of exports) {
          const messageId = classifyExport(node);
          if (messageId !== null) context.report({ node, messageId });
        }
      },
    };
  },
});
