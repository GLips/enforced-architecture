import type { Definition, ESTree, Scope, SourceCode, Variable, Visitor } from "@oxlint/plugins";
import { staticKeyName } from "./static-key-name.ts";
import { outermostTransparentWrapper } from "./transparent-wrappers.ts";

// Every name a file takes from a NAMED SET of modules, under the exporting module's spelling. A
// rule that fences on names — `View` from react-native, `Textarea` from @mantine/core — asks this
// question and nothing else, so asking it in one place is what stops each rule answering it
// differently.
//
// This reads oxlint's scope analysis rather than walking ImportDeclarations. Not a refactor: an
// ImportDeclaration visitor cannot see `import * as RN; RN.View` at all, because the name never
// appears in a specifier. Scope analysis hands over the binding and every reference to it, already
// resolved — so a local `const View` inside a function shadowing an import is a different Variable,
// and is not a use of it. The `require` half is resolved the same way rather than matched on the
// word: `function f(require) { require("react-native") }` loads nothing, and a rule that reported
// it would be over-matching on the one spelling with no binding to point at.
//
// Scope analysis does not link `require()` or `await import()` to a module at all: those bindings
// arrive as an ordinary `Variable` definition with no module attached, so their specifier is read
// off the declarator's initializer. That half is unavoidable AST work, and `boundary/
// ambient-globals` reads the same `runtimeImportSpecifier` for it.
//
// NEGATIVE SPACE, and each of these is a spelling that reaches the module and reports nothing:
//   - A computed key that is not a string literal (`RN[name]`) — see `staticKeyName`.
//   - A specifier that is not a literal or a substitution-free template: `require(name)`,
//     ``import(`pkg/${part}`)``. There is nothing to fence on.
//   - `import("m").then(({ View }) => …)`: the name is bound by a parameter of a callback, so
//     following it means following the promise, which is a whole-program question.
//   - A module bound by assignment rather than by declaration (`let RN; RN = require("m")`): the
//     binding's definition carries no initializer, so nothing links it to a module.
//   - A name reached through a NESTED destructure (`const { Animated: { View } } = require("m")`).
//     The export actually read is the outer key, which binds nothing and so has no Variable; the
//     inner name is not an export of the module and is deliberately not reported as one.
//   - Passing the namespace on as a value (`export const RN2 = RN`, `f(RN)`): the read happens in
//     whatever code receives it, which this file never sees. `export * from "m"` is the same leak
//     and IS catchable, so the rules here fence that one themselves.
//   - Re-exports of any kind. This answers what the file IMPORTS; a rule that also cares about
//     what it hands on reads `ExportNamedDeclaration` / `ExportAllDeclaration` itself, because the
//     blame node and usually the message differ.
//
// ONE CONVENTION FOR THE CONDITIONS BELOW, because a file that applies two teaches neither. A
// condition that decides what this module FINDS is pinned by a fixture — delete it and a spec goes
// red, without exception. A condition that only narrows a type, or names which of two nodes a
// binding is, stays even where no input reaches its other branch: it is how the next reader knows
// the shape being matched. Where a condition claimed to decide something and did not, it was
// deleted and replaced by a comment saying why the absence is deliberate — `takeNamespaceReads`
// below carries one, and `takeFromImportBinding` the other.

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
 *
 * `sourceCode` is here for `require` alone, which is a plain identifier a file may rebind. The
 * module loader is the one that resolves to no declaration; a parameter or a local named `require`
 * has one, and calling it loads nothing.
 */
export function runtimeImportSpecifier(
  node: ESTree.Node | null | undefined,
  sourceCode: SourceCode,
): string | undefined {
  if (node === null || node === undefined) return undefined;
  const loaded = node.type === "AwaitExpression" ? node.argument : node;
  if (loaded.type === "ImportExpression") return staticSpecifier(loaded.source);
  if (loaded.type !== "CallExpression") return undefined;
  if (loaded.callee.type !== "Identifier" || loaded.callee.name !== "require") return undefined;
  if (isRebound(loaded.callee, sourceCode)) return undefined;
  return staticSpecifier(loaded.arguments[0]);
}

/**
 * Whether the name this identifier reads was declared by the file rather than by the environment.
 *
 * A declared global — `env: { node: true }` — is a global-scope Variable with no definition, so the
 * definition count is the question and the mere existence of a Variable is not. Same distinction
 * `boundary/ambient-globals` draws to find an ambient read.
 */
function isRebound(identifier: ESTree.Node, sourceCode: SourceCode): boolean {
  const name = identifier.type === "Identifier" ? identifier.name : undefined;
  if (name === undefined) return false;
  for (let scope: Scope | null = sourceCode.getScope(identifier); scope !== null; scope = scope.upper) {
    const variable = scope.set.get(name);
    if (variable !== undefined) return variable.defs.length > 0;
  }
  return false;
}

/**
 * A specifier that names one module for certain: a string literal, or a template with no
 * substitution.
 *
 * The backtick form is here for the reason `lib/module-source-visitor.ts` gives for carrying it —
 * ``require(`react-native`)`` is the same edge as `require("react-native")`, and it is exactly the
 * spelling someone reaches for to make a fence stop matching. A template WITH a substitution names
 * a family of modules and gets `undefined` rather than its literal prefix.
 */
function staticSpecifier(node: ESTree.Node | undefined): string | undefined {
  if (node === undefined) return undefined;
  if (node.type === "Literal") return typeof node.value === "string" ? node.value : undefined;
  if (node.type !== "TemplateLiteral" || node.expressions.length > 0) return undefined;
  const [quasi] = node.quasis;
  const cooked = quasi?.value.cooked;
  return typeof cooked === "string" ? cooked : undefined;
}

/**
 * Calls back once per name this file takes from any of `moduleSpecifiers`, with the node to blame
 * and the module it came from.
 *
 * The name is always the EXPORTING module's: `import { View as Screen }` reports `View`, because
 * the fence is on what the module hands over, not on what this file decided to call it.
 *
 * A SET of modules rather than one, though every rule in the catalog fences a single module today.
 * The visitor this returns is spread into a rule's own visitor object, so a rule calling it twice
 * would have the second call's `Program:exit` key silently overwrite the first's — one whole module
 * going unchecked with nothing to see. Taking the set is what makes that unwritable.
 *
 * Names are buffered and delivered at `Program:exit` in source order. oxlint emits diagnostics in
 * the order a rule reports them, and the two spellings that bind nothing are found mid-traversal
 * while the scope answer is a whole-file one — so without the sort a file's diagnostics come out
 * grouped by how the name was spelled rather than by where it is.
 *
 * NO SPEC PINS THE SORT, and one cannot: `RuleTester` sorts a rule's diagnostics by span before
 * comparing, so under the harness the ordering is right either way. Verified against the oxlint
 * CLI instead — `import { Text }` on line 1 and `require(…).View` on line 2 come out 2 then 1
 * without it. Delete it and every spec stays green.
 */
export function visitImportedNames(
  sourceCode: SourceCode,
  moduleSpecifiers: readonly string[],
  onImportedName: (name: string, node: ESTree.Node, moduleSpecifier: string) => void,
): Visitor {
  const found: { name: string; node: ESTree.Node; specifier: string }[] = [];
  const take = (name: string, node: ESTree.Node, specifier: string) => {
    found.push({ name, node, specifier });
  };

  /**
   * A read straight off the load expression, which binds nothing: `(await import("m")).View`,
   * `require("m").View`. There is no Variable for scope analysis to answer about, so this is the
   * one spelling that has to come off the AST — and the one a fence on bindings alone leaves open.
   */
  const takeUnboundMemberRead = (node: ESTree.Node) => {
    const specifier = runtimeImportSpecifier(node, sourceCode);
    if (specifier === undefined || !moduleSpecifiers.includes(specifier)) return;
    // `(require("m") as never).View` is the same read with a TypeScript node wedged in.
    const loaded = outermostTransparentWrapper(node);
    const parent: ESTree.Node | null | undefined = loaded.parent;
    if (parent === null || parent === undefined) return;
    if (parent.type !== "MemberExpression" || parent.object !== loaded) return;
    const key = staticKeyName(parent.property, parent.computed);
    if (key !== undefined) take(key, parent, specifier);
  };

  const takePatternKeys = (pattern: ESTree.Node, specifier: string) => {
    if (pattern.type !== "ObjectPattern") return;
    for (const property of pattern.properties) {
      // A rest element (`const { View, ...rest } = RN`) names no key, and is not a Property node.
      if (property.type !== "Property") continue;
      const key = staticKeyName(property.key, property.computed);
      if (key !== undefined) take(key, property, specifier);
    }
  };

  /**
   * The names read off a binding that IS the module: a namespace import, a default import, or
   * `const RN = require("m")`. Both spellings of a read count — `RN.View` and `const { View } = RN`
   * reach the same export, and only the first one looks like a member access.
   */
  const takeNamespaceReads = (variable: Variable, specifier: string) => {
    // NOT filtered on `reference.init`, though a destructured binding does list its own pattern
    // site as a reference. Nothing that arrives here has one: a namespace binding is never written,
    // and a `const RN = require("m")` initializer is the call rather than the identifier, so its
    // init reference matches none of the shapes below.
    for (const reference of variable.references) {
      const parent: ESTree.Node | null | undefined = reference.identifier.parent;
      if (parent === null || parent === undefined) continue;
      if (parent.type === "MemberExpression" && parent.object === reference.identifier) {
        const key = staticKeyName(parent.property, parent.computed);
        if (key !== undefined) take(key, parent, specifier);
        continue;
      }
      // `<RN.View />` is the same read in JSX's own node shapes: a JSXMemberExpression whose
      // property is a JSXIdentifier and never computed. A rule fencing a component library that
      // read only MemberExpression would miss every use site that renders.
      //
      // No object check, unlike the arm above: only the leftmost name in `<A.B.C />` resolves to a
      // binding, so a reference whose parent is a JSXMemberExpression is always that parent's
      // object. JSX models its identifiers as a separate node family, so the two are the same node
      // with types that do not overlap and the check could not be written as an identity anyway.
      if (parent.type === "JSXMemberExpression") {
        // `<RN.View>…</RN.View>` names the binding twice and resolves both, so the closing tag has
        // to be dropped or one element draws two diagnostics. Climbing first is what keeps
        // `<RN.A.View>` working: the reference's parent there is the INNER member expression.
        let outermost: ESTree.Node = parent;
        while (outermost.parent?.type === "JSXMemberExpression") outermost = outermost.parent;
        if (outermost.parent?.type === "JSXClosingElement") continue;
        take(parent.property.name, parent, specifier);
        continue;
      }
      if (parent.type === "VariableDeclarator" && parent.init === reference.identifier) {
        takePatternKeys(parent.id, specifier);
      }
    }
  };

  const takeFromImportBinding = (variable: Variable, definition: Definition) => {
    const specifier = definition.node;

    // `import RN = require("m")` binds a value, compiles under `module: preserve`, and reaches no
    // ImportDeclaration. Scope analysis files it as an ImportBinding whose node is the whole
    // declaration, so the specifier hangs off the module reference rather than off a `source` —
    // and the reference can name a local namespace (`import RN = NS`) rather than a module at all.
    //
    // The type-only spelling needs no guard, unlike the ImportDeclaration one below: a type-only
    // binding can only be read in type position, and a type-position read is a TSQualifiedName,
    // which is not a shape `takeNamespaceReads` matches.
    if (specifier.type === "TSImportEqualsDeclaration") {
      const reference = specifier.moduleReference;
      if (reference.type !== "TSExternalModuleReference") return;
      if (!moduleSpecifiers.includes(reference.expression.value)) return;
      takeNamespaceReads(variable, reference.expression.value);
      return;
    }

    const declaration = definition.parent;
    if (declaration === null || declaration.type !== "ImportDeclaration") return;
    const from = declaration.source.value;
    if (!moduleSpecifiers.includes(from)) return;
    // A type-only import is erased: it binds no runtime value, so it reads nothing from the module.
    // Scope analysis creates the Variable either way, so this is not optional.
    if (declaration.importKind === "type") return;

    if (specifier.type !== "ImportSpecifier") {
      takeNamespaceReads(variable, from);
      return;
    }
    if (specifier.importKind === "type") return;
    const name = exportedName(specifier.imported);
    // `{ default as RN }` is the default export wearing a named specifier's node shape — it binds
    // the module object rather than an export named `default`, so reads through it are the
    // namespace's, not a name called "default".
    if (name === "default") {
      takeNamespaceReads(variable, from);
      return;
    }
    take(name, specifier, from);
  };

  const takeFromRuntimeImportBinding = (variable: Variable, definition: Definition) => {
    const declarator = definition.node;
    if (declarator.type !== "VariableDeclarator") return;
    const specifier = runtimeImportSpecifier(declarator.init, sourceCode);
    if (specifier === undefined || !moduleSpecifiers.includes(specifier)) return;

    // Each name in a destructure is its own Variable pointing at the SAME declarator, so the whole
    // pattern must not be read here — it would report every key once per key bound. The binding's
    // own property is the one this Variable is about, one node further out when the binding carries
    // a default (`const { View = Fallback } = …`), which is an AssignmentPattern in between.
    const bound: ESTree.Node = definition.name;
    const holder: ESTree.Node | null | undefined = bound.parent;
    const property: ESTree.Node | null | undefined =
      holder !== null && holder !== undefined && holder.type === "AssignmentPattern"
        ? holder.parent
        : holder;
    if (property !== null && property !== undefined && property.type === "Property") {
      // Only a property of the declarator's OWN pattern reads an export. In
      // `const { Animated: { View } } = require("m")` the export read is `Animated`; `View` is a
      // property of it, and reporting `View` would name an export the module does not have.
      if (property.parent !== declarator.id) return;
      const key = staticKeyName(property.key, property.computed);
      if (key !== undefined) take(key, property, specifier);
      return;
    }
    // Only a binding that IS the whole module object reads members off it. An array pattern
    // (`const [RN] = require("m")`) binds an element of it, which is not the module.
    if (declarator.id === definition.name) takeNamespaceReads(variable, specifier);
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
      found.sort((left, right) => left.node.range[0] - right.node.range[0]);
      for (const { name, node, specifier } of found) onImportedName(name, node, specifier);
    },
  };
}
