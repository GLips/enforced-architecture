// Shared reading of exported component declarations, for the three `react` rules that count
// something per component: `prop-count`, `hook-count` and `single-component-export`.
//
// "What is a component" is one question, and three rules holding three private opinions about it
// means a declaration form one of them fails to recognise is a component that rule skips in
// silence — a clean run that checked less than it looked like it did. Answering it once here is
// what keeps them governing the same set.
//
// The forms read as one thing and are separate nodes: `export function Name()`, `export default
// function Name()`, an arrow assigned to a `const`, and a `memo`/`forwardRef` binding. Cover the
// first and the rest go unread, and the unread ones carry the smell — the component tucked in
// beside another is usually the small arrow, not the exported function declaration.
//
// ── Adapt ──
// `WRAPPER_NAMES` names the higher-order components whose argument is the real component. Add a
// project's own wrapper (`observer` from mobx, a `withTheme`) if components arrive through it.

import type { ESTree } from "@oxlint/plugins";

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
 */
export function exportedComponents(program: ESTree.Program): ComponentDeclaration[] {
  const found: ComponentDeclaration[] = [];

  for (const statement of program.body) {
    if (statement.type !== "ExportNamedDeclaration" && statement.type !== "ExportDefaultDeclaration") {
      continue;
    }

    const declaration = statement.declaration;
    if (declaration === null || declaration === undefined) continue;

    if (declaration.type === "FunctionDeclaration") {
      // An anonymous `export default function () {}` has no name to report and no name to grep
      // for, which is a different complaint than any of these three rules makes.
      if (declaration.id !== null && COMPONENT_NAME.test(declaration.id.name)) {
        found.push({ name: declaration.id.name, node: declaration, fn: declaration });
      }
      continue;
    }

    if (declaration.type !== "VariableDeclaration") continue;

    for (const declarator of declaration.declarations) {
      if (declarator.id.type !== "Identifier" || !COMPONENT_NAME.test(declarator.id.name)) continue;
      if (declarator.init === null || declarator.init === undefined) continue;

      const fn = componentFunctionOf(declarator.init);
      if (fn === undefined) continue;
      found.push({ name: declarator.id.name, node: declarator, fn });
    }
  }

  return found;
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
