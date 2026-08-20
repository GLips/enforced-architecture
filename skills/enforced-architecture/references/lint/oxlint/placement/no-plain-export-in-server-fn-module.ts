// ─── placement/no-plain-export-in-server-fn-module ────────────────────
//
// Tag:      placement
// Mechanism: oxlint JS plugin (per-file, real-time)
// Blocking: Yes
//
// Prevents: Runtime exports other than compiler bridges in a non-server
//           module that defines createServerFn or createMiddleware.
//           Client compilation replaces server-function handlers and strips
//           middleware .server() and .validator() calls; it does not
//           erase sibling runtime exports.
//
// Allows:   Type-only exports, exported createServerFn/createMiddleware
//           bridges, and module-private helpers.
//
// Fix:      Move server-only runtime exports to a .server.ts sibling. Move
//           client-safe exports to their own module.
//
// Source:   @tanstack/start-plugin-core/src/start-compiler/
//           handleCreateServerFn.ts, handleCreateMiddleware.ts
//
// Applies:  Non-.server source files containing createServerFn or
//           createMiddleware calls. Excludes tests and scripts.
//
// Negative space: This rule does not detect top-level side effects or prove
//                 client reachability. Cross-file safety belongs to the
//                 client-boundary graph checks.
//
//                 The bridge exemption reads the initializer's call chain, so
//                 an annotated, parenthesized, `satisfies`-suffixed or
//                 non-null-asserted bridge is exempt while
//                 `export const helper = () => createServerFn()` — which
//                 leaks a real function to the client — is not.
//
//                 A bridge is only recognized in the inline
//                 `export const name = createServerFn(…)` spelling. Routed
//                 through a later `export { name }` clause it is reported,
//                 because the clause gives the rule no binding to inspect
//                 without cross-statement resolution. Inline is the spelling
//                 the compiler needs anyway: it resolves a server fn through
//                 its variable declarator and throws
//                 "createServerFn must be assigned to a variable!" otherwise,
//                 which is why `export default createServerFn(…)` gets its
//                 own diagnostic rather than the move-it-elsewhere one.
//
// ── Adapt ─────────────────────────────────────────────────────────────
//
// 1. Compiler bridge factories — `COMPILER_BRIDGE_FACTORIES`:
//    The factory names whose exported chains are the sanctioned bridges.
//    Replace them for a framework with equivalent compiler bridges. This
//    set is also the gate: a module that calls none of them is not this
//    rule's business.
//
// 2. The hard server-only fence — `SERVER_ONLY_PATH`:
//    Files matching it are exempt because the suffix already blocks client
//    imports. Update it when the project fences server-only modules some
//    other way.
//
// 3. Declarations that emit no runtime — `TYPE_ONLY_DECLARATIONS`:
//    Erased at compile time, so they may be exported freely. Rarely needs
//    changing; note that `enum` and `namespace` are deliberately absent
//    because both emit a runtime object.
//
// 4. Registration:
//    Add the rule to the project's oxlint plugin
//    (`rules: { "no-plain-export-in-server-fn-module":
//    noPlainExportInServerFnModuleRule }`) and turn it on in
//    `.oxlintrc.json`
//    (`"<plugin>/no-plain-export-in-server-fn-module": "error"`).
//
// ──────────────────────────────────────────────────────────────────────

import { defineRule, type ESTree } from "@oxlint/plugins";
import { isArchitectureExemptPath } from "../lib/architecture-exempt-paths.ts";

const COMPILER_BRIDGE_FACTORIES = new Set(["createServerFn", "createMiddleware"]);
const SERVER_ONLY_PATH = /\.server\.[tj]sx?$/;
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

export const noPlainExportInServerFnModuleRule = defineRule({
  meta: {
    type: "problem",
    messages: {
      runtimeExportLeak:
        "Only createServerFn/createMiddleware bridges and types may be exported from a compiler-processed module. Move this runtime export to a client-safe or .server.ts sibling.",
      defaultBridgeExport:
        "A createServerFn/createMiddleware bridge must be assigned to a named const — the compiler resolves it through its variable declarator. Change `export default createServerFn(…)` to `export const <name> = createServerFn(…)`.",
    },
  },
  create(context) {
    const { filename } = context;
    if (isArchitectureExemptPath(filename) || SERVER_ONLY_PATH.test(filename)) return {};

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
