import type { ESTree, Visitor } from "@oxlint/plugins";

// Every place a module specifier can appear: the four static forms, `import()`, the two CommonJS
// spellings, `import x = require(…)`, and `import("…")` in type position. Boundary rules fence on
// the specifier string, and a fence that misses one form is one `await import()` — or one
// `export … from` — away from useless, so they all go through here rather than each rule picking
// the node types it happened to think of.
//
// This is the single biggest correctness win of the port. Under GritQL the same coverage needed
// `or { JsModuleSource() as $source, \`import($source)\` }` pasted into every boundary template,
// and the templates that forgot the second arm silently ignored dynamic imports.
//
// `require()` and `require.resolve()` are here because the resolved import graph retains both and
// this helper did not, so the two tiers disagreed about what an import even IS — and a rule the
// graph would have caught passed the linter. This is NOT a prohibition on CommonJS: the two
// spellings create the same dependency, so a rule about dependencies has to see both.
// `typescript/no-require-imports` exists if the prohibition is ever wanted as well.
//
// The TypeScript-only spellings are here for the same reason the CommonJS ones are: they compile,
// they name an aliased module, and the tier that owns aliased specifiers is this one. A form that
// only this tier can see is a form that escapes BOTH tiers when it is missed, because the resolved
// graph skips every non-relative edge.
//
// NEGATIVE SPACE: a computed specifier — `import(path)`, `require(name)`, an interpolated template
// — is not visited, because there is nothing to fence on. A template with no substitutions IS
// checkable and is visited. `boundary/ambient-globals` does not read this helper at all: its
// subject is a global rather than a module edge, and the module spellings it does recognise are
// one field on one policy row.

/**
 * The node a diagnostic is anchored to. A `TemplateElement` rather than a cast, because the only
 * honest node for `import(`@/shared/utils`)` is the quasi itself — casting it to a StringLiteral
 * would make the type lie to every consumer to save one union member.
 */
export type ModuleSourceNode = ESTree.StringLiteral | ESTree.TemplateElement;

export function visitModuleSources(
  onSource: (source: ModuleSourceNode, specifier: string) => void,
): Visitor {
  return {
    ImportDeclaration(node) {
      onSource(node.source, node.source.value);
    },
    ExportNamedDeclaration(node) {
      if (node.source !== null) onSource(node.source, node.source.value);
    },
    ExportAllDeclaration(node) {
      onSource(node.source, node.source.value);
    },
    ImportExpression(node) {
      onStaticSpecifier(node.source, onSource);
    },
    TSImportEqualsDeclaration(node) {
      // `import env = require("@/env.server")` binds a value at runtime and compiles under
      // `module: preserve`. It reaches no ImportDeclaration visitor and no CallExpression one.
      if (node.moduleReference.type !== "TSExternalModuleReference") return;
      onSource(node.moduleReference.expression, node.moduleReference.expression.value);
    },
    TSImportType(node) {
      // `type S = import("@/features/billing").Invoice`. Erased, and still coupling: the rows that
      // deny an area deny it for a type import too, which is what `isTypeOnlyDeclaration` below
      // reports for this node.
      onSource(node.source, node.source.value);
    },
    CallExpression(node) {
      if (!isRequireCallee(node.callee)) return;
      onStaticSpecifier(node.arguments[0], onSource);
    },
  };
}

/** Adapts `staticModuleSpecifier` to the callback shape the visitor arms above use. */
function onStaticSpecifier(
  source: ESTree.Node | undefined,
  onSource: (source: ModuleSourceNode, specifier: string) => void,
): void {
  const found = staticModuleSpecifier(source);
  if (found !== undefined) onSource(found.node, found.specifier);
}

/**
 * The one module a specifier expression names, with the node to blame for it — or `undefined` when
 * it names a family rather than a module.
 *
 * A computed specifier (`import(path)`, `require(name)`) has nothing to fence on. A literal is
 * checkable, and so is a template with no substitutions — ``import(`@/shared/utils`)`` is the same
 * edge, and the backtick is exactly the spelling someone reaches for to make a fence stop matching.
 * Both forms are answered here rather than by each caller, because the caller that answered for
 * itself is the one that carried the literal and forgot the template.
 *
 * THE ONE OWNER of "is this specifier statically known, and what is it". This was two private
 * copies, one here and one in `lib/imported-names.ts`, and they agreed on every input — which is
 * the reason to merge them rather than a reason not to. Their COVERAGE diverged: ea-41 fixed the
 * same backtick bypass in each, one round apart, and only one of the two grew a fixture. So
 * ``import(`@/infrastructure/db/${name}`)`` — the negative space this module's header names — was
 * asserted against one copy and against nothing on the other, and nothing would have reported the
 * next patch landing on one side only.
 *
 * The return is an object because the two callers want different halves: `visitModuleSources` blames
 * a node and `runtimeImportSpecifier` returns a bare string. A superset of both is one function; a
 * string return would put the blame node back in the caller, which is where the second copy started.
 *
 * Takes `undefined` so the missing-argument case — `require()` — is answered here rather than at
 * each call site. That guard was written in both copies too, in different places.
 *
 * NEGATIVE SPACE: a template WITH a substitution names a family of modules and gets `undefined`
 * rather than its literal prefix. A non-string literal — `require(0)` — names no module. A quasi
 * whose `cooked` is null cannot be reached: an invalid escape is a SyntaxError outside a tagged
 * template, and a tagged template is not a `TemplateLiteral`. It is refused rather than trusted.
 *
 * All three refusals are pinned, and from both sides — `boundary/import-policy` for the visitor half
 * and `style/no-raw-primitives` for the `runtimeImportSpecifier` half. The non-string one is not
 * merely a type narrow: force it through with a cast and `require(0)` hands every consumer a NUMBER
 * as its specifier, which dies in the first rule to call `.split` on it. It decides what this
 * module finds, so it is fixtured like the other two, per the convention `lib/imported-names.ts`
 * states.
 */
export function staticModuleSpecifier(
  source: ESTree.Node | undefined,
): { node: ModuleSourceNode; specifier: string } | undefined {
  if (source === undefined) return undefined;
  if (source.type === "Literal") {
    return typeof source.value === "string" ? { node: source, specifier: source.value } : undefined;
  }
  if (source.type !== "TemplateLiteral" || source.expressions.length > 0) return undefined;
  const [quasi] = source.quasis;
  const cooked = quasi?.value.cooked;
  if (quasi === undefined || typeof cooked !== "string") return undefined;
  return { node: quasi, specifier: cooked };
}

/**
 * `require` or `require.resolve`, and neither `foo.require` nor a computed
 * `require[key]`. The member form matters as much as the bare one: `require.resolve` binds no
 * value and still names the module, so a rule about which modules a file may reach has to see it.
 */
function isRequireCallee(callee: ESTree.CallExpression["callee"]): boolean {
  if (callee.type === "Identifier") return callee.name === "require";
  if (callee.type !== "MemberExpression" || callee.computed) return false;
  return (
    callee.object.type === "Identifier" &&
    callee.object.name === "require" &&
    callee.property.type === "Identifier" &&
    callee.property.name === "resolve"
  );
}

/**
 * A type import creates no runtime dependency, so a file may NAME any type it likes even where it
 * may not depend on the module at runtime.
 *
 * The declaration-level `import type` / `export type` is the easy half. The half that matters is
 * the inline spelling: `import { type Invoice, parseInvoice } from "./invoice"` has
 * `importKind: "value"` at the declaration and still binds `parseInvoice` at runtime, so only an
 * import whose every specifier is type-only is erased. A bare `import "pkg"` has no specifiers at
 * all and is pure side effect — the `length > 0` guard is what keeps it a runtime edge.
 *
 * Pass `source.parent` from `visitModuleSources`. An `ImportExpression`, a `require()` and a
 * `require.resolve()` all fall through to false, which is correct: none of them has a type-only
 * form, and `import type` has no dynamic spelling. The two TypeScript spellings do have one, and
 * both are answered here — a `TSImportType` is erased by definition, and
 * `import type X = require(…)` is legal TS whose literal's parent is the module reference rather
 * than the declaration.
 */
export function isTypeOnlyDeclaration(declaration: ESTree.Node): boolean {
  switch (declaration.type) {
    case "ImportDeclaration":
      return (
        declaration.importKind === "type" ||
        (declaration.specifiers.length > 0 &&
          declaration.specifiers.every(
            (specifier) => specifier.type === "ImportSpecifier" && specifier.importKind === "type",
          ))
      );
    case "ExportNamedDeclaration":
      return (
        declaration.exportKind === "type" ||
        (declaration.specifiers.length > 0 &&
          declaration.specifiers.every((specifier) => specifier.exportKind === "type"))
      );
    case "ExportAllDeclaration":
      return declaration.exportKind === "type";
    case "TSImportType":
      return true;
    case "TSExternalModuleReference":
      return (
        declaration.parent.type === "TSImportEqualsDeclaration" &&
        declaration.parent.importKind === "type"
      );
    default:
      return false;
  }
}
