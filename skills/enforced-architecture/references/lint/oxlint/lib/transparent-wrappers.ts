import type { ESTree } from "@oxlint/plugins";

/**
 * The expression nodes that wrap a value without changing what it is.
 *
 * `(process).env`, `process!.env` and `(globalThis as never).localStorage` are the same read with a
 * node wedged in. Stepping through them is a few lines; not stepping through them is a bypass that
 * TypeScript syntax hands over for free — and it is a bypass a reader cannot see, because the
 * source still says `process.env`.
 *
 * Every member of this set carries its operand on `expression`, which is what makes one predicate
 * cover all six.
 */
export const TRANSPARENT_EXPRESSION_WRAPPERS = new Set([
  "ParenthesizedExpression",
  "ChainExpression",
  "TSNonNullExpression",
  "TSAsExpression",
  "TSSatisfiesExpression",
  "TSTypeAssertion",
]);

/**
 * The outermost node that still IS `node`'s value: `node` itself when nothing wraps it, and the
 * last wrapper otherwise.
 *
 * For a caller asking "what is my parent" about an expression, this is the node whose parent is the
 * real one. `oxlint` emits no `ParenthesizedExpression` under its default options, so the cases
 * that actually bite are the TypeScript ones.
 */
export function outermostTransparentWrapper(node: ESTree.Node): ESTree.Node {
  let outermost = node;
  for (;;) {
    const parent: ESTree.Node | null | undefined = outermost.parent;
    if (parent === null || parent === undefined) return outermost;
    if (!TRANSPARENT_EXPRESSION_WRAPPERS.has(parent.type)) return outermost;
    if (!("expression" in parent) || parent.expression !== outermost) return outermost;
    outermost = parent;
  }
}
