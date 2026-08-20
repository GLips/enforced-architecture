import type { ESTree } from "@oxlint/plugins";

/**
 * The expression nodes that wrap a value without changing what it is.
 *
 * `(process).env`, `process!.env` and `(globalThis as never).localStorage` are the same read with a
 * node wedged in. Stepping through them is a few lines; not stepping through them is a bypass that
 * TypeScript syntax hands over for free — and it is a bypass a reader cannot see, because the
 * source still says `process.env`.
 *
 * Every member carries its operand on `expression`, which is what makes one predicate cover all
 * five. The predicate is the export rather than the set: a `Set<string>` membership test tells
 * TypeScript nothing, and the callers all need to reach `.expression` afterwards.
 *
 * NEGATIVE SPACE: `ParenthesizedExpression` is deliberately absent. oxlint does not emit the node
 * under its default options — `(process).env` arrives with the parens already gone — so a member
 * for it is a branch no fixture can reach, and an unreachable branch is indistinguishable from a
 * broken one. A tier that turns paren preservation on adds it back with a fixture.
 */
type TransparentWrapper =
  | ESTree.ChainExpression
  | ESTree.TSNonNullExpression
  | ESTree.TSAsExpression
  | ESTree.TSSatisfiesExpression
  | ESTree.TSTypeAssertion;

const TRANSPARENT_WRAPPER_TYPES: readonly TransparentWrapper["type"][] = [
  "ChainExpression",
  "TSNonNullExpression",
  "TSAsExpression",
  "TSSatisfiesExpression",
  "TSTypeAssertion",
];

export function isTransparentWrapper(node: ESTree.Node): node is TransparentWrapper {
  return TRANSPARENT_WRAPPER_TYPES.some((type) => type === node.type);
}

/**
 * The value inside every transparent wrapper around `node`: `require("m")` for
 * `(require("m") as never)`, and `node` itself when nothing wraps it.
 *
 * The inward direction, for a caller holding a node and asking what it IS — an initializer, an
 * awaited operand. `outermostTransparentWrapper` is the same question from the other end, for a
 * caller asking what its parent is.
 */
export function withoutTransparentWrappers(node: ESTree.Node): ESTree.Node {
  let inner = node;
  while (isTransparentWrapper(inner)) inner = inner.expression;
  return inner;
}

/**
 * The outermost node that still IS `node`'s value: `node` itself when nothing wraps it, and the
 * last wrapper otherwise. Its parent is the first node that does something with the value.
 */
export function outermostTransparentWrapper(node: ESTree.Node): ESTree.Node {
  let outermost = node;
  for (;;) {
    const parent: ESTree.Node | null | undefined = outermost.parent;
    if (parent === null || parent === undefined) return outermost;
    // No `parent.expression === outermost` check: every wrapper has exactly one expression slot,
    // and its other slot holds a TYPE, whose children are type nodes that never reach this climb.
    if (!isTransparentWrapper(parent)) return outermost;
    outermost = parent;
  }
}
