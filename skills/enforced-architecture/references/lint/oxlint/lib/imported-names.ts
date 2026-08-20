import type { Definition, ESTree, SourceCode, Variable, Visitor } from "@oxlint/plugins";
import { staticKeyName } from "./static-key-name.ts";

// Every name a file takes from ONE module, under the exporting module's spelling. A rule that
// fences on names — `View` from react-native, `Textarea` from @mantine/core — asks this question
// and nothing else, so asking it in one place is what stops each rule answering it differently.
//
// This reads oxlint's scope analysis rather than walking ImportDeclarations. Not a refactor: an
// ImportDeclaration visitor cannot see `import * as RN; RN.View` at all, because the name never
// appears in a specifier. Scope analysis hands over the binding and every reference to it, already
// shadow-correct — a local `const View` inside a function is a different Variable, so it is not a
// use of the import and needs no position guard here.
//
// Scope analysis does NOT link `require()` or `await import()` to a module: those bindings arrive
// as an ordinary `Variable` definition with no module of any kind attached, so their specifier is
// read off the declarator's initializer. That half is unavoidable AST work, and `boundary/
// ambient-globals` reads the same `runtimeImportSpecifier` for it.
//
// NEGATIVE SPACE, and each of these is a spelling that reaches the module and reports nothing:
//   - A computed key that is not a string literal (`RN[name]`) — see `staticKeyName`.
//   - `import("m").then(({ View }) => …)`: the name is bound by a parameter of a callback, so
//     following it means following the promise, which is a whole-program question.
//   - Passing the namespace on as a value (`export const RN2 = RN`, `f(RN)`): the read happens in
//     whatever code receives it, which this file never sees. `export * from "m"` is the same leak
//     and IS catchable, so the rules here fence that one themselves.
//   - Re-exports of any kind. This answers what the file IMPORTS; a rule that also cares about
//     what it hands on reads `ExportNamedDeclaration` / `ExportAllDeclaration` itself, because the
//     blame node and usually the message differ.

/** The exporting module's name for a specifier, which is the one a local alias cannot change. */
export function exportedName(name: ESTree.ModuleExportName): string {
  return name.type === "Literal" ? name.value : name.name;
}

/**
 * The module a runtime load expression names: `require("m")`, `import("m")`, `await import("m")`.
 *
 * The static forms are scope analysis's to answer. These three are the ones it cannot: they bind
 * through an ordinary variable, or through no binding at all, so the specifier only exists on the
 * initializer. `require.resolve` is deliberately absent — it names a path and loads nothing, so no
 * name comes out of it.
 */
export function runtimeImportSpecifier(node: ESTree.Node | null | undefined): string | undefined {
  if (node === null || node === undefined) return undefined;
  const loaded = node.type === "AwaitExpression" ? node.argument : node;
  if (loaded.type === "ImportExpression") return literalString(loaded.source);
  if (loaded.type !== "CallExpression") return undefined;
  if (loaded.callee.type !== "Identifier" || loaded.callee.name !== "require") return undefined;
  return literalString(loaded.arguments[0]);
}

function literalString(node: ESTree.Node | undefined): string | undefined {
  if (node === undefined || node.type !== "Literal") return undefined;
  return typeof node.value === "string" ? node.value : undefined;
}

/**
 * Calls back once per name this file takes from `moduleSpecifier`, with the node to blame.
 *
 * The name is always the EXPORTING module's: `import { View as Screen }` reports `View`, because
 * the fence is on what the module hands over, not on what this file decided to call it.
 *
 * Names arrive in no particular order — the scope answer is a whole-file one delivered at
 * `Program:exit`, while the two unbound spellings are found mid-traversal. oxlint sorts the
 * diagnostics a rule reports by span, so a caller that reports as it is called still reads in
 * source order.
 */
export function visitImportedNames(
  sourceCode: SourceCode,
  moduleSpecifier: string,
  onImportedName: (name: string, node: ESTree.Node) => void,
): Visitor {
  /**
   * A read straight off the load expression, which binds nothing: `(await import("m")).View`,
   * `require("m").View`. There is no Variable for scope analysis to answer about, so this is the
   * one spelling that has to come off the AST — and the one a fence on bindings alone leaves open.
   */
  const takeUnboundMemberRead = (loaded: ESTree.Node) => {
    if (runtimeImportSpecifier(loaded) !== moduleSpecifier) return;
    const parent: ESTree.Node | null | undefined = loaded.parent;
    if (parent === null || parent === undefined) return;
    if (parent.type !== "MemberExpression" || parent.object !== loaded) return;
    const key = staticKeyName(parent.property, parent.computed);
    if (key !== undefined) onImportedName(key, parent);
  };

  const takePatternKeys = (pattern: ESTree.Node) => {
    if (pattern.type !== "ObjectPattern") return;
    for (const property of pattern.properties) {
      if (property.type !== "Property") continue;
      const key = staticKeyName(property.key, property.computed);
      if (key !== undefined) onImportedName(key, property);
    }
  };

  /**
   * The names read off a binding that IS the module: a namespace import, a default import, or
   * `const RN = require("m")`. Both spellings of a read count — `RN.View` and `const { View } = RN`
   * reach the same export, and only the first one looks like a member access.
   */
  const takeNamespaceReads = (variable: Variable) => {
    // NOT filtered on `reference.init`, though a destructured binding does list its own pattern
    // site as a reference. Nothing that arrives here has one: a namespace binding is never written,
    // and a `const RN = require("m")` initializer is the call rather than the identifier, so its
    // init reference matches none of the shapes below.
    for (const reference of variable.references) {
      const parent: ESTree.Node | null | undefined = reference.identifier.parent;
      if (parent === null || parent === undefined) continue;
      if (parent.type === "MemberExpression" && parent.object === reference.identifier) {
        const key = staticKeyName(parent.property, parent.computed);
        if (key !== undefined) onImportedName(key, parent);
        continue;
      }
      // `<RN.View />` is the same read in JSX's own node shapes: a JSXMemberExpression whose
      // property is a JSXIdentifier and never computed. A rule fencing a component library that
      // read only MemberExpression would miss every use site that renders.
      //
      // Matched on span rather than identity: JSX models its identifiers as a separate node family,
      // so this reference and `parent.object` are the same node with types that do not overlap.
      // Only the leftmost name in `<A.B.C />` resolves to a binding at all, so it is always this one.
      if (
        parent.type === "JSXMemberExpression" &&
        parent.object.range[0] === reference.identifier.range[0]
      ) {
        if (parent.property.type === "JSXIdentifier") onImportedName(parent.property.name, parent);
        continue;
      }
      if (parent.type === "VariableDeclarator" && parent.init === reference.identifier) {
        takePatternKeys(parent.id);
      }
    }
  };

  const takeFromImportBinding = (variable: Variable, definition: Definition) => {
    const specifier = definition.node;

    // `import RN = require("m")` binds a value, compiles under `module: preserve`, and reaches no
    // ImportDeclaration. Scope analysis files it as an ImportBinding whose node is the whole
    // declaration, so the specifier hangs off the module reference rather than off a `source`.
    //
    // The type-only spelling needs no guard, unlike the ImportDeclaration one below: a type-only
    // binding can only be read in type position, and a type-position read is a TSQualifiedName,
    // which is not a shape `takeNamespaceReads` matches.
    if (specifier.type === "TSImportEqualsDeclaration") {
      const reference = specifier.moduleReference;
      if (reference.type !== "TSExternalModuleReference") return;
      if (reference.expression.value !== moduleSpecifier) return;
      takeNamespaceReads(variable);
      return;
    }

    const declaration = definition.parent;
    if (declaration === null || declaration.type !== "ImportDeclaration") return;
    if (declaration.source.value !== moduleSpecifier) return;
    // A type-only import is erased: it binds no runtime value, so it reads nothing from the module.
    // Scope analysis creates the Variable either way, so this is not optional.
    if (declaration.importKind === "type") return;

    if (specifier.type !== "ImportSpecifier") {
      takeNamespaceReads(variable);
      return;
    }
    if (specifier.importKind === "type") return;
    const name = exportedName(specifier.imported);
    // `{ default as RN }` is the default export wearing a named specifier's node shape — it binds
    // the module object rather than an export named `default`, so reads through it are the
    // namespace's, not a name called "default".
    if (name === "default") {
      takeNamespaceReads(variable);
      return;
    }
    onImportedName(name, specifier);
  };

  const takeFromRuntimeImportBinding = (variable: Variable, definition: Definition) => {
    const declarator = definition.node;
    if (declarator.type !== "VariableDeclarator") return;
    if (runtimeImportSpecifier(declarator.init) !== moduleSpecifier) return;

    // Each name in a destructure is its own Variable pointing at the SAME declarator, so the whole
    // pattern must not be read here — it would report every key once per key. The binding's own
    // property is the one this Variable is about.
    const property: ESTree.Node | null | undefined = definition.name.parent;
    if (property !== null && property !== undefined && property.type === "Property") {
      const key = staticKeyName(property.key, property.computed);
      if (key !== undefined) onImportedName(key, property);
      return;
    }
    if (declarator.id === definition.name) takeNamespaceReads(variable);
  };

  return {
    ImportExpression(node) {
      takeUnboundMemberRead(node.parent?.type === "AwaitExpression" ? node.parent : node);
    },

    CallExpression(node) {
      takeUnboundMemberRead(node);
    },

    "Program:exit"() {
      // Every scope, not just the module one: `function f() { const { View } = require("m") }`
      // binds inside a function scope, and a module-scope-only sweep calls that file clean.
      for (const scope of sourceCode.scopeManager.scopes) {
        for (const variable of scope.variables) {
          const [definition] = variable.defs;
          if (definition === undefined) continue;
          if (definition.type === "ImportBinding") takeFromImportBinding(variable, definition);
          if (definition.type === "Variable") takeFromRuntimeImportBinding(variable, definition);
        }
      }
    },
  };
}
