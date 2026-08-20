import type { ESTree } from "@oxlint/plugins";

/**
 * The name a member expression or an object-pattern property reads, whichever way it is spelled.
 *
 * `process.env` and `process["env"]` are the same read and different nodes, and the computed form
 * is the one a linted codebase drifts toward once a rule starts matching the dotted one. Resolving
 * both here is what keeps the two spellings from needing two arms in every caller.
 *
 * NEGATIVE SPACE: a key that is not statically known — `ns[name]`, a template with a substitution,
 * a `Symbol` — names nothing a per-file rule can follow, and gets `undefined` rather than a guess.
 * A caller that stops there is correct; one that falls back to the source text is guessing. A
 * numeric key is `undefined` too: no module exports a name a number could spell.
 */
export function staticKeyName(key: ESTree.Node, computed: boolean): string | undefined {
  // A non-computed key is an Identifier OR a string literal — `{ "localStorage": ls }` is a quoted
  // property, not a computed one, and reading only Identifier there misses it while the computed
  // arm below catches the equivalent `{ ["localStorage"]: ls }`.
  if (key.type === "Identifier") return computed ? undefined : key.name;
  return key.type === "Literal" && typeof key.value === "string" ? key.value : undefined;
}
