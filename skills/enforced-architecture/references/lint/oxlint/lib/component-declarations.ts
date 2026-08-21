// Shared reading of exported component declarations, for the three `react` rules that count
// something per component: `prop-count`, `hook-count` and `single-component-export`.
//
// "What is a component" is one question, and three rules holding three private opinions about it
// means a declaration form one of them fails to recognise is a component that rule skips in
// silence — a clean run that checked less than it looked like it did. Answering it once here is
// what keeps them governing the same set.
//
// The forms read as one thing and are separate nodes: `export function Name()`, `export default
// function Name()`, an arrow assigned to a `const`, a `memo`/`forwardRef` binding, and the two
// spellings that export a declaration made earlier in the file — `export { Name }` and `export
// default Name`. Cover the first and the rest go unread, and the unread ones carry the smell — the
// component tucked in beside another is usually the small arrow, not the exported function
// declaration, and a file written `const Card = …; const CardRow = …; export { Card, CardRow }`
// has every component it declares in the one place a declaration-only reader never looks.
//
// The export list is resolved through oxlint's SCOPE ANALYSIS rather than by matching names
// against the file's own declarations. Not a refactor: scope analysis already knows that
// `export { Card } from "./card"` binds nothing here (so it is a re-export, not a declaration) and
// that `export { View }` naming an import is that module's component and not this file's, and both
// fall out as an unresolved or non-declaration reference rather than as arms someone has to
// remember to write.
//
// NEGATIVE SPACE:
//   - `export * from "./panels"` hands on components this file never declares. Nothing about them
//     is readable here, and counting the statement as one component would be a guess at a number.
//   - `export { Card }` where `Card` is a parameter, a `let` reassigned later, or any binding whose
//     declaration is not a function-or-declarator: the value at export time is a data-flow
//     question, and these rules read declarations.
//   - An anonymous `export default () => {}` or `export default function () {}` has no name to
//     report and no name to grep for, which is a different complaint than any of these three rules
//     makes.
//
// ── Adapt ──
// `WRAPPER_NAMES` names the higher-order components whose argument is the real component. Add a
// project's own wrapper (`observer` from mobx, a `withTheme`) if components arrive through it.

import type { ESTree, SourceCode } from "@oxlint/plugins";

/** React's convention, and the only signal available without a type checker. */
const COMPONENT_NAME = /^[A-Z]/;

const WRAPPER_NAMES = new Set(["memo", "forwardRef"]);

/**
 * oxlint models `function f() {}` and `const f = function () {}` as one `Function` node carrying a
 * `type` discriminant, so the two spellings need no separate handling here.
 */
export type ComponentFunction = ESTree.ArrowFunctionExpression | ESTree.Function;

export type ComponentDeclaration = {
  name: string;
  /** What a finding points at, so the diagnostic lands on the declaration rather than on its body. */
  node: ESTree.Node;
  /**
   * The function whose parameters and body are the COMPONENT'S, unwrapped from any
   * `memo`/`forwardRef` around it. Null when the wrapper was handed a reference rather than a
   * function literal — `export const Card = memo(CardImpl)` names a component whose surface is
   * declared elsewhere.
   */
  fn: ComponentFunction | null;
};

/**
 * Every exported component declaration in `program`, in source order.
 *
 * The bound VALUE is tested, never the name alone. A PascalCase const is routinely not a
 * component — `export const AllComponentsCtx = createContext(…)` and `export const DRAG_SLOP = 4`
 * both pass a name-only test, and reporting those trains people to ignore the rule, which costs
 * more than the smell it was watching for. That over-match is invisible to every positive fixture;
 * only a legal neighbour catches it.
 *
 * A component is listed once however many times it is exported. `export default Card` beside
 * `export { Card }` is legal and ordinary, and two entries for one declaration would tell
 * `single-component-export` that a one-component file holds two.
 *
 * The name is the DECLARATION'S, not the exported one: `export { CardImpl as Card }` is reported
 * as `CardImpl`, because these three rules send a reader to the declaration and that is the name
 * they will find when they get there.
 */
export function exportedComponents(
  program: ESTree.Program,
  sourceCode: SourceCode,
): ComponentDeclaration[] {
  // Keyed by where the declaration starts, which is what makes the de-duplication above and the
  // source ordering below one fact rather than two passes. Source order matters to
  // `single-component-export`, which blames the SECOND component and lists them all in its message;
  // an export list sits below the declarations it names, so appending as the statements are walked
  // would order a mixed file by its export statements instead.
  const found = new Map<number, ComponentDeclaration>();
  const take = (component: ComponentDeclaration | undefined) => {
    if (component !== undefined) found.set(component.node.range[0], component);
  };

  for (const statement of program.body) {
    if (statement.type !== "ExportNamedDeclaration" && statement.type !== "ExportDefaultDeclaration") {
      continue;
    }

    const declaration = statement.declaration;
    if (declaration === null || declaration === undefined) {
      if (statement.type !== "ExportNamedDeclaration") continue;
      for (const specifier of statement.specifiers) {
        take(declaredComponent(specifier.local, sourceCode));
      }
      continue;
    }

    if (declaration.type === "FunctionDeclaration") {
      take(componentOfFunctionDeclaration(declaration));
      continue;
    }

    // `export default Card`, the identifier form. The declaration it names is elsewhere in the
    // file, so it is resolved exactly as an export list's local name is.
    if (declaration.type === "Identifier") {
      take(declaredComponent(declaration, sourceCode));
      continue;
    }

    if (declaration.type !== "VariableDeclaration") continue;
    for (const declarator of declaration.declarations) take(componentOfDeclarator(declarator));
  }

  return [...found.values()].sort((one, other) => one.node.range[0] - other.node.range[0]);
}

/**
 * The component a local name was declared as, or undefined when the name resolves to no
 * declaration in this file — an import, a re-export's specifier, a binding of some other kind.
 */
function declaredComponent(
  local: ESTree.Node,
  sourceCode: SourceCode,
): ComponentDeclaration | undefined {
  // `export { "a-b" as Card }` spells its local name as a string literal, which binds nothing a
  // reference can resolve.
  if (local.type !== "Identifier") return undefined;

  const scope = sourceCode.getScope(local);
  const reference = scope.references.find(
    (candidate) => candidate.identifier.range[0] === local.range[0],
  );
  // The DEFINITION'S NODE is the whole test, and it is the only one: an import's definition node is
  // an `ImportSpecifier`, a re-export's specifier resolves to no variable at all, and neither is a
  // shape either arm below matches. A second filter on the definition's KIND would say the same
  // thing twice and could only ever disagree with this one.
  for (const definition of reference?.resolved?.defs ?? []) {
    const node: ESTree.Node = definition.node;
    if (node.type === "FunctionDeclaration") return componentOfFunctionDeclaration(node);
    if (node.type === "VariableDeclarator") return componentOfDeclarator(node);
  }
  return undefined;
}

function componentOfFunctionDeclaration(
  declaration: ESTree.Function,
): ComponentDeclaration | undefined {
  if (declaration.id === null || !COMPONENT_NAME.test(declaration.id.name)) return undefined;
  return { name: declaration.id.name, node: declaration, fn: declaration };
}

function componentOfDeclarator(
  declarator: ESTree.VariableDeclarator,
): ComponentDeclaration | undefined {
  if (declarator.id.type !== "Identifier" || !COMPONENT_NAME.test(declarator.id.name)) {
    return undefined;
  }
  if (declarator.init === null || declarator.init === undefined) return undefined;

  const fn = componentFunctionOf(declarator.init);
  if (fn === undefined) return undefined;
  return { name: declarator.id.name, node: declarator, fn };
}

/**
 * The function a component binding evaluates to, `null` for a wrapper given a reference, and
 * `undefined` when the bound value is not a component at all.
 */
function componentFunctionOf(init: ESTree.Expression): ComponentFunction | null | undefined {
  if (init.type === "ArrowFunctionExpression" || init.type === "FunctionExpression") return init;
  if (init.type !== "CallExpression") return undefined;
  if (!isWrapperCallee(init.callee)) return undefined;

  const [wrapped] = init.arguments;
  if (wrapped === undefined) return null;
  if (wrapped.type === "ArrowFunctionExpression" || wrapped.type === "FunctionExpression") {
    return wrapped;
  }
  // `memo(CardImpl)` — a component, but its parameters and body are declared elsewhere.
  return null;
}

/** `memo(…)`, `forwardRef(…)`, and the namespaced spellings `React.memo(…)` / `React.forwardRef(…)`. */
function isWrapperCallee(callee: ESTree.CallExpression["callee"]): boolean {
  if (callee.type === "Identifier") return WRAPPER_NAMES.has(callee.name);
  return (
    callee.type === "MemberExpression" &&
    !callee.computed &&
    callee.property.type === "Identifier" &&
    WRAPPER_NAMES.has(callee.property.name)
  );
}
