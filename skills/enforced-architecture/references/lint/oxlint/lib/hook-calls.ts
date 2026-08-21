// The one answer to "which React hook does this call name", for the four sites in `react/` that
// ask it: `hook-count` counts every hook call, `no-async-effect` watches `useEffect` and
// `useCallback`, and `derived-state` watches `useEffect` and `useState`.
//
// Four copies of the question was four answers to it, and the disagreement was not exotic — it was
// `React.useEffect`. `hook-count` counted the namespaced spelling, the two `error`-severity rules
// read `Identifier` only and went silent on it, so one file with `React.` on every hook drew a
// warning about hook volume and nothing about the async effect leaking inside it. A rule that
// reports the whole file except the one line that matters is worse than one that reports nothing,
// because the clean half certifies the missing half.
//
// THE HOOK'S NAME IS THE EXPORTING MODULE'S, not the local one. `import { useEffect as useE }`
// calls `useEffect`, and `import { createStore as useStore }` does not call a hook however the
// local spelling reads. That is `lib/imported-names.ts`'s rule — "the fence is on what the module
// hands over, not on what this file decided to call it" — held here so the react tier and the name
// fences answer the aliasing question the same way. Before this, `hook-count`'s `/^use[A-Z]/`
// matched `useE` by accident of the letter after `use`, while the other three matched it not at
// all: three behaviours for one question, none of them decided.
//
// NEGATIVE SPACE, each a spelling that calls a hook and is reported by nobody:
//   - A member read whose key is not statically known: `React[hookName]()`. `staticKeyName` owns
//     that refusal, and there is no name to compare against.
//   - A hook reached through a local binding rather than a call: `const fx = useEffect; fx(…)`.
//     Following an assignment is a data-flow question, and the four rules here read one file.
//   - A member read whose key is aliased on the OTHER side: `hooks.effect(…)` re-exported from a
//     local module as React's `useEffect`. Only the property name is available here, and following
//     it means opening another file.
//   - The default-imported hook, `import useEffect from "react"`. There is no exported name on an
//     `ImportDefaultSpecifier`, so the local spelling is all there is and it is what gets used.
//
// The OBJECT of a member read is deliberately not checked: `React.useEffect`, `ReactDOM.useEffect`
// and `whatever.useEffect` are all read as `useEffect`. Requiring the object to be React means
// deciding what React is called in this file, which is a second import question with its own
// aliasing, and the over-match it prevents — an unrelated object with a method named `use[A-Z]` —
// is not a shape anyone writes.

import type { ESTree, SourceCode } from "@oxlint/plugins";
import { exportedName } from "./imported-names.ts";
import { staticKeyName } from "./static-key-name.ts";

/** React's convention, and what `use` in a call position means without a type checker. */
const HOOK_NAME = /^use[A-Z]/;

/**
 * The hook a callee names — `useEffect(…)`, `React.useEffect(…)`, `React["useEffect"](…)`, and the
 * aliased import of any of them — or undefined when the callee names no hook.
 *
 * The return is a NAME rather than a boolean because two of the four callers need to know WHICH
 * hook, and a caller comparing `hookCallName(callee, sourceCode) === "useEffect"` is asking the
 * same question as one testing it for undefined.
 */
export function hookCallName(
  callee: ESTree.CallExpression["callee"],
  sourceCode: SourceCode,
): string | undefined {
  const name = calleeName(callee, sourceCode);
  return name !== undefined && HOOK_NAME.test(name) ? name : undefined;
}

function calleeName(
  callee: ESTree.CallExpression["callee"],
  sourceCode: SourceCode,
): string | undefined {
  if (callee.type === "Identifier") return importedNameOf(callee, sourceCode) ?? callee.name;
  // `staticKeyName` resolves the quoted spelling too, so the computed arm needs no branch here.
  if (callee.type === "MemberExpression") return staticKeyName(callee.property, callee.computed);
  return undefined;
}

/**
 * The name the exporting module gave an identifier, or undefined when this file did not import it.
 *
 * Asks the RESOLVED reference rather than the scope chain by name, for the reason
 * `lib/imported-names.ts` gives: a local `const useEffect` inside a function shadowing an import is
 * a different Variable and is not a use of it.
 */
function importedNameOf(
  identifier: ESTree.IdentifierReference,
  sourceCode: SourceCode,
): string | undefined {
  const scope = sourceCode.getScope(identifier);
  const reference = scope.references.find(
    (candidate) => candidate.identifier.range[0] === identifier.range[0],
  );
  // The DEFINITION'S NODE is the whole test, as in `lib/component-declarations.ts`: every other
  // way a name can be bound — a `const`, a parameter, a namespace or default import — has a node
  // that is not an `ImportSpecifier`, and a second filter on the definition's KIND would say the
  // same thing twice. Every definition is walked rather than the first, because oxlint merges a
  // type declaration and a value declaration of one name into a single `Variable` with two.
  //
  // NO type-only arm, unlike `lib/imported-names.ts`, which must have one because it answers what a
  // file READS from a module and a type-only read is not one. Here the node is already a callee, so
  // an erased binding in that position is code that cannot run — whichever name this returns for it
  // describes nothing that happens.
  for (const definition of reference?.resolved?.defs ?? []) {
    const specifier: ESTree.Node = definition.node;
    if (specifier.type === "ImportSpecifier") return exportedName(specifier.imported);
  }
  return undefined;
}
