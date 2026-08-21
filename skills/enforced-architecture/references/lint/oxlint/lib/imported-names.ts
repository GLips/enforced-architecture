import type { Definition, ESTree, SourceCode, Variable, Visitor } from "@oxlint/plugins";
import { staticModuleSpecifier } from "./module-source-visitor.ts";
import { staticKeyName } from "./static-key-name.ts";
import {
  outermostTransparentWrapper,
  withoutTransparentWrappers,
} from "./transparent-wrappers.ts";

// Every name a file takes from a NAMED SET of modules, under the exporting module's spelling. A
// rule that fences on names — `View` from react-native, `Textarea` from @mantine/core, `env` from
// node:process — asks this question and nothing else, so asking it in one place is what stops each
// rule answering it differently.
//
// The set is a LIST OF MODULE NAMES — exact spellings, never a pattern, and there is no overload
// that takes one: a module set matched by predicate is the off-switch-in-a-costume the
// catalog's posture rules out, and it is also what kept `boundary/ambient-globals` on a private
// copy of this walk long enough for the two to disagree about a cast inside an await.
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
// off the declarator's initializer. That half is unavoidable AST work.
//
// NEGATIVE SPACE, and each of these is a spelling that reaches the module and reports nothing:
//   - A computed key that is not a string literal (`RN[name]`) — see `staticKeyName`.
//   - A specifier that is not a literal or a substitution-free template: `require(name)`,
//     ``import(`pkg/${part}`)``. There is nothing to fence on.
//   - `import("m").then(({ View }) => …)`: the name is bound by a parameter of a callback, so
//     following it means following the promise, which is a whole-program question.
//   - A module bound by assignment rather than by declaration (`let RN; RN = require("m")`): the
//     binding's definition carries no initializer, so nothing links it to a module.
//   - The INNER name of a nested destructure (`const { Animated: { View } } = require("m")`). The
//     export the module hands over is `Animated`, and that outer key IS reported; `View` is a
//     property of it rather than an export, and reporting it would name one the module does not
//     have.
//   - A destructure that binds NO name at all (`const { View: {} } = require("m")`). Every answer
//     here starts from a `Variable`, and a pattern with nothing in it creates none. Any bound name
//     anywhere in the pattern brings the whole pattern back — `{ View: {}, Text }` reports both —
//     and a pattern that binds nothing hands the file nothing a later line can read, which is why
//     this is stated rather than closed with a second sweep from the AST side.
//   - The CommonJS interop hop, `require("m").default.View` and `RN.default.View`. `default` is
//     followed on the SPECIFIER side, where an ImportBinding says structurally that the name is the
//     module object; a member read cannot be told apart from an export genuinely called `default`,
//     and following it there would have to follow `const { default: RN } = require("m")` too, which
//     binds a name and is a different walk again. One decision for all three, or none.
//   - Passing the namespace on as a value (`export const RN2 = RN`, `f(RN)`): the read happens in
//     whatever code receives it, which this file never sees. `export * from "m"` is the same leak
//     and IS catchable, so the rules here fence that one themselves.
//   - Re-exports of any kind, `export = RN` included. This answers what the file IMPORTS; a rule
//     that also cares about what it hands on reads `ExportNamedDeclaration` / `ExportAllDeclaration`
//     itself, because the blame node and usually the message differ.
//
// ONE CONVENTION FOR THE CONDITIONS BELOW, because a file that applies two teaches neither. A
// condition that decides what this module FINDS is pinned by a fixture — delete it and a spec goes
// red, without exception. A condition that only narrows a type, or names WHICH SLOT of its parent
// a node fills (`parent.object === node` beside a `parent.property` that `staticKeyName` already
// refuses), stays even where no input reaches its other branch: it is how the next reader knows
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
function runtimeImportSpecifier(
  node: ESTree.Node | null | undefined,
  sourceCode: SourceCode,
): string | undefined {
  if (node === null || node === undefined) return undefined;
  // `require("m") as never` and `(await import("m"))!` load the same module. Stripped at both
  // levels, because the cast can sit inside the await or around it.
  const outer = withoutTransparentWrappers(node);
  const loaded =
    outer.type === "AwaitExpression" ? withoutTransparentWrappers(outer.argument) : outer;
  if (loaded.type === "ImportExpression") return staticModuleSpecifier(loaded.source)?.specifier;
  if (loaded.type !== "CallExpression") return undefined;
  if (loaded.callee.type !== "Identifier" || loaded.callee.name !== "require") return undefined;
  if (isRebound(loaded.callee, sourceCode)) return undefined;
  return staticModuleSpecifier(loaded.arguments[0])?.specifier;
}

/**
 * Whether this `require` is the file's own rather than the module loader.
 *
 * Asks the RESOLVED reference, not the scope chain by name. A name lookup answers a different
 * question and gets three cases wrong: `type require = number` and `interface require {}` declare
 * nothing callable, and the loader's own ambient declaration —
 * `declare function require(id: string): any`, the idiomatic way to tell TypeScript the loader
 * exists — would read as a rebind and turn the fence off for the whole file.
 *
 * An unresolved reference is the loader: nothing in the file declares it. A resolved one is a
 * rebind unless every definition it has is ambient, and a declared environment (`env: node`) gives
 * a global-scope Variable with no definitions at all.
 */
function isRebound(identifier: ESTree.IdentifierReference, sourceCode: SourceCode): boolean {
  const scope = sourceCode.getScope(identifier);
  const reference = scope.references.find(
    (candidate) => candidate.identifier.range[0] === identifier.range[0],
  );
  const variable = reference?.resolved;
  if (variable === null || variable === undefined) return false;
  // An ambient declaration describes something that exists already, so it binds nothing of its own.
  // `declare` sits on the DECLARATION, and a `Variable` definition's node is the DECLARATOR inside
  // it — so `declare var require`, which is how @types/node itself spells the loader, needs the
  // climb. Reading `declare` off the declarator finds nothing there and calls it a rebind, which
  // turns every `require()` spelling in the file off.
  return variable.defs.some((definition) => {
    const declaration: ESTree.Node | null | undefined =
      definition.node.type === "VariableDeclarator" ? definition.parent : definition.node;
    if (declaration === null || declaration === undefined) return true;
    return !("declare" in declaration && declaration.declare === true);
  });
}

/**
 * Calls back once per load expression that binds NO name and has a member read taken off it:
 * `require("m").View`, `(await import("m")).env`. The callback gets the module's specifier and the
 * node that IS the module object, whose parent is the member read.
 *
 * PRIVATE, and it must stay that way. It was exported once, for a second rule that wanted the
 * module object rather than the key — and having the walk reachable from outside is what let that
 * rule keep its own module selection beside this file's. Two copies of this exact walk had already
 * let `(await (import("m") as never)).env` escape one rule while the other caught it: the same
 * cast, the same walk, two answers. A rule that needs this needs `visitImportedNames`.
 */
function visitUnboundModuleObjects(
  sourceCode: SourceCode,
  onModuleObject: (specifier: string, moduleObject: ESTree.Node) => void,
): Visitor {
  const visit = (node: ESTree.Node) => {
    const specifier = runtimeImportSpecifier(node, sourceCode);
    if (specifier === undefined) return;
    // `(require("m") as never).View` is the same read with a TypeScript node wedged in.
    const moduleObject = outermostTransparentWrapper(node);
    const parent: ESTree.Node | null | undefined = moduleObject.parent;
    if (parent === null || parent === undefined) return;
    // A load nobody reads from is nothing to fence: `await import("m")` for its side effects only.
    if (parent.type !== "MemberExpression" || parent.object !== moduleObject) return;
    onModuleObject(specifier, moduleObject);
  };

  return {
    ImportExpression(node) {
      // The read hangs off the AWAIT, not the import — and a cast may sit between the two
      // (`await (import("m") as never)`), so the await is found from the outermost wrapper.
      const loaded = outermostTransparentWrapper(node);
      visit(loaded.parent?.type === "AwaitExpression" ? loaded.parent : node);
    },

    CallExpression(node) {
      visit(node);
    },
  };
}

/**
 * Calls back once per name this file takes from any of `moduleSpecifiers`, with the node to blame
 * and the module it came from.
 *
 * The name is always the EXPORTING module's: `import { View as Screen }` reports `View`, because
 * the fence is on what the module hands over, not on what this file decided to call it.
 *
 * A SET of modules rather than one: `boundary/ambient-globals` fences `process` and `node:process`,
 * which are one module under two spellings. The visitor this returns is spread into a rule's own
 * visitor object, so a rule calling it twice would have the second call's `Program` key silently
 * overwrite the first's — one whole module going unchecked with nothing to see. Taking the set is
 * what makes that unwritable.
 *
 * Callbacks fire in no particular order, and deliberately: the scope sweep runs at `Program` while
 * the two spellings that bind nothing are found mid-traversal, so nothing here can put a file's
 * findings in source order. Ordering is `lib/source-ordered-reports.ts`'s, which is the only place
 * that sees ALL of a rule's diagnostics — a sort here would order the imported names among
 * themselves and still emit them after every diagnostic the rule's other arms raise.
 *
 * THE VISITOR RETURNED CARRIES NO `Program:exit`, and must not grow one. The sweep runs at
 * `Program` instead — scope analysis is complete before traversal starts, so the answer is the
 * same either way. A consuming rule owns `Program:exit` for its ordered flush, and a spread key
 * and an owned key cannot share: whichever is second in the object literal wins silently, and
 * either loss takes a whole arm of the rule with it.
 */
export function visitImportedNames(
  sourceCode: SourceCode,
  moduleSpecifiers: readonly string[],
  onImportedName: (name: string, node: ESTree.Node, moduleSpecifier: string) => void,
): Visitor {
  const take = onImportedName;

  /**
   * The key of a read straight off the load expression, which binds nothing:
   * `(await import("m")).View`. There is no Variable for scope analysis to answer about, so this is
   * the one spelling that has to come off the AST — and the one a fence on bindings alone leaves
   * open. `visitUnboundModuleObjects` above owns the walk that gets here.
   */
  const takeUnboundMemberRead = (specifier: string, moduleObject: ESTree.Node) => {
    if (!moduleSpecifiers.includes(specifier)) return;
    // Narrowing only, not a decision: `visitUnboundModuleObjects` has already established that
    // this parent is a MemberExpression reading off `moduleObject`. There is no other caller.
    const read = moduleObject.parent;
    if (read === null || read === undefined || read.type !== "MemberExpression") return;
    const key = staticKeyName(read.property, read.computed);
    if (key !== undefined) take(key, read, specifier);
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
      // `(RN as never).View` reads the same binding with a TypeScript node wedged in.
      const read = outermostTransparentWrapper(reference.identifier);
      const parent: ESTree.Node | null | undefined = read.parent;
      if (parent === null || parent === undefined) continue;
      if (parent.type === "MemberExpression" && parent.object === read) {
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
      if (parent.type === "VariableDeclarator" && parent.init === read) {
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

  /**
   * Declarators whose pattern has already been read. Every name a destructure binds is its own
   * Variable pointing at the SAME declarator, so without this the pattern is read once per name
   * bound and every key draws that many diagnostics.
   *
   * Per FILE, not per rule: the visitor this closure belongs to is built inside `create`, which
   * oxlint calls once per source file.
   */
  const patternsRead = new Set<ESTree.Node>();

  const takeFromRuntimeImportBinding = (variable: Variable, definition: Definition) => {
    const declarator = definition.node;
    if (declarator.type !== "VariableDeclarator") return;
    const specifier = runtimeImportSpecifier(declarator.init, sourceCode);
    if (specifier === undefined || !moduleSpecifiers.includes(specifier)) return;

    // Only a binding that IS the whole module object reads members off it. An array pattern
    // (`const [RN] = require("m")`) binds an element of it, which is not the module.
    if (declarator.id === definition.name) {
      takeNamespaceReads(variable, specifier);
      return;
    }

    // Otherwise the name sits somewhere inside a destructure, and the exports read are the keys of
    // the declarator's OWN pattern — whatever depth the binding that led here was found at. Read
    // from the pattern rather than climbing back up from the binding: `const { env: { KEY } } =
    // require("m")` binds only `KEY`, whose own property belongs to the inner pattern, so a climb
    // that stops at "not a direct child of `declarator.id`" reports nothing for a file that plainly
    // takes `env` from the module. Reading the pattern is also what makes this agree with the
    // namespace spelling — `const RN = require("m"); const { env: { KEY } } = RN` has always
    // reported `env`, through `takeNamespaceReads` above.
    if (patternsRead.has(declarator)) return;
    patternsRead.add(declarator);
    takePatternKeys(declarator.id, specifier);
  };

  return {
    ...visitUnboundModuleObjects(sourceCode, takeUnboundMemberRead),

    Program() {
      // Every scope, not just the module one: `function f() { const { View } = require("m") }`
      // binds inside a function scope, and a module-scope-only sweep calls that file clean.
      for (const scope of sourceCode.scopeManager.scopes) {
        for (const variable of scope.variables) {
          // NOT `defs[0]`. A name declared in type space first — `type View = number` above
          // `import { View } from "react-native"` — makes the type declaration definition zero, and
          // reading only that one turns the fence off for a name in legal, compiling TypeScript.
          // The first definition that BINDS is the one, and a name has at most one.
          const definition = variable.defs.find(
            (candidate) => candidate.type === "ImportBinding" || candidate.type === "Variable",
          );
          if (definition === undefined) continue;
          if (definition.type === "ImportBinding") takeFromImportBinding(variable, definition);
          else takeFromRuntimeImportBinding(variable, definition);
        }
      }
    },
  };
}
