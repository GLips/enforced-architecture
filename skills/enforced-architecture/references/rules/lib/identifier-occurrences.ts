import type { ESTree, Visitor } from "@oxlint/plugins";

/**
 * Visits each place a bare name appears, once per span.
 *
 * Some rules are a claim about a NAME rather than a call — importing `createServerFn`, aliasing it,
 * or reaching it through a namespace all get you the same ungated constructor, so the name itself
 * is the thing to find. The dedupe matters because a shorthand import specifier
 * (`import { createServerFn }`) is two Identifier nodes — the imported name and the local binding —
 * over one span, which would otherwise draw two diagnostics on one word.
 */
export function visitIdentifierNamed(
  name: string,
  onOccurrence: (node: ESTree.Node) => void,
): Visitor {
  const seenOffsets = new Set<number>();
  return {
    Identifier(node) {
      if (node.name !== name) return;
      const [start] = node.range;
      if (seenOffsets.has(start)) return;
      seenOffsets.add(start);
      onOccurrence(node);
    },
  };
}
