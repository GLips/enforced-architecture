import type { ESTree } from "@oxlint/plugins";

/**
 * The name a member expression or an object-pattern property reads, whichever way it is spelled.
 *
 * `process.env` and `process["env"]` are the same read and different nodes, and the computed form
 * is the one a linted codebase drifts toward once a rule starts matching the dotted one. Resolving
 * both here is what keeps the two spellings from needing two arms in every caller.
 *
 * NEGATIVE SPACE: a computed key that is not a string literal — `ns[name]`, a template with a
 * substitution, a `Symbol` — names nothing a per-file rule can follow, and gets `undefined` rather
 * than a guess. A caller that stops there is correct; one that falls back to the source text is
 * guessing.
 */
export function staticKeyName(key: ESTree.Node, computed: boolean): string | undefined {
  if (!computed) return key.type === "Identifier" ? key.name : undefined;
  return key.type === "Literal" && typeof key.value === "string" ? key.value : undefined;
}
