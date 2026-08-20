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
      // A computed specifier (`import(path)`) has nothing to fence on. A literal is checkable, and
      // so is a template with no substitutions — `import(`@/shared/utils`)` is the same edge, and the
      // backtick is exactly the spelling someone reaches for to make a fence stop matching.
      if (node.source.type === "Literal" && typeof node.source.value === "string") {
        onSource(node.source, node.source.value);
        return;
      }
      if (node.source.type === "TemplateLiteral" && node.source.expressions.length === 0) {
        const [quasi] = node.source.quasis;
        const cooked = quasi?.value.cooked;
        if (quasi !== undefined && typeof cooked === "string") {
          onSource(quasi, cooked);
        }
      }
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
      const [argument] = node.arguments;
      if (argument === undefined || argument.type !== "Literal") return;
      if (typeof argument.value !== "string") return;
      onSource(argument, argument.value);
    },
  };
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
