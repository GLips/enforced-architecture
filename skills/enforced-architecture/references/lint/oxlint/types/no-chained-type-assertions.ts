// ─── types/no-chained-type-assertions ────────────────────────────────
//
// Tag:      types
// Mechanism: oxlint JS plugin (per-file, real-time)
// Blocking: Yes
//
// Prevents: Stacked assertions — `value as unknown as User`, and the
//           angle-bracket and mixed spellings of the same thing.
//
//           A single assertion asks TypeScript to accept a claim it can
//           partly check: the two types must overlap. Routing through
//           `unknown` removes even that. The chain exists precisely
//           because the compiler rejected the direct version, so it is
//           a compiler objection deleted rather than answered — and it
//           is the single most reliable signal in generated code that a
//           model could not make a type work and stopped trying.
//
//           This rule is the reason `types/require-safety-comment` has
//           teeth. On its own that rule accepts one sentence covering a
//           whole chain, so the strongest escape hatch in the language
//           costs the same as the weakest. Adopt them together.
//
// Excludes: Chains made only of `as const`, which narrow literals and
//           assert nothing about provenance.
//
// Applies:  All .ts and .tsx files EXCEPT:
//           - Test files and scripts
//
// Error:    "This assertion chain routes around the compiler instead of
//            answering it — `as unknown as T` removes even the overlap
//            check a single assertion keeps. Parse the value at its
//            boundary and return a named type, or fix the type that
//            made the direct assertion fail."
//
// ── Adapt ─────────────────────────────────────────────────────────────
//
// 1. The const carve-out — `isConstAssertion`:
//    `x as const as const` is pointless but harmless, so a chain of
//    only const assertions is allowed. One non-const link anywhere in
//    the chain makes the whole thing report. Drop `isConstAssertion` to
//    ban every chain unconditionally.
//
// 2. Reporting once per chain — `isOutermostAssertionInChain`:
//    Only the outer assertion reports, so `a as unknown as T` is one
//    diagnostic rather than two. Without the check every link reports
//    and the count scales with the chain length, which reads as several
//    problems instead of one.
//
// 3. This rule does not catch the split spelling:
//    `const b: unknown = a; const c = b as T` is the same round trip
//    across two statements and is invisible here, because the
//    assertions are not nested. `types/no-widen-then-assert` is the
//    rule for that flow; neither covers the other.
//
// 4. Registration:
//    Add the rule to the project's oxlint plugin
//    (`rules: { "no-chained-type-assertions": noChainedTypeAssertionsRule }`)
//    and turn it on in `.oxlintrc.json`
//    (`"<plugin>/no-chained-type-assertions": "error"`).
//
// ──────────────────────────────────────────────────────────────────────

import { defineRule, type ESTree } from "@oxlint/plugins";
import { isArchitectureExemptPath } from "../lib/architecture-exempt-paths.ts";

type TypeAssertion = ESTree.TSAsExpression | ESTree.TSTypeAssertion;

function isTypeAssertion(node: ESTree.Node): node is TypeAssertion {
  return node.type === "TSAsExpression" || node.type === "TSTypeAssertion";
}

function isConstAssertion(node: TypeAssertion): boolean {
  return (
    node.typeAnnotation.type === "TSTypeReference" &&
    node.typeAnnotation.typeName.type === "Identifier" &&
    node.typeAnnotation.typeName.name === "const"
  );
}

// Only the outermost link reports, so one chain is one diagnostic. No parenthesis walk is needed
// on the way up: oxlint surfaces no ParenthesizedExpression node, so `(a as unknown) as T` arrives
// as directly nested assertions. Verified against oxlint 1.77.0, and the spec asserts the
// parenthesized spelling still reports exactly once.
function isOutermostAssertion(node: TypeAssertion): boolean {
  return !isTypeAssertion(node.parent) || node.parent.expression !== node;
}

export const noChainedTypeAssertionsRule = defineRule({
  meta: {
    type: "problem",
    messages: {
      chained:
        "This assertion chain routes around the compiler instead of answering it — `as unknown as T` removes even the overlap check a single assertion keeps. Parse the value at its boundary and return a named type, or fix the type that made the direct assertion fail.",
    },
  },
  create(context) {
    if (isArchitectureExemptPath(context.filename)) return {};

    const checkAssertion = (node: TypeAssertion) => {
      if (!isOutermostAssertion(node)) return;

      let links = 0;
      let hasNonConstLink = false;
      let current: ESTree.Expression = node;
      while (isTypeAssertion(current)) {
        links += 1;
        hasNonConstLink ||= !isConstAssertion(current);
        current = current.expression;
      }

      if (links > 1 && hasNonConstLink) context.report({ node, messageId: "chained" });
    };

    return {
      TSAsExpression: checkAssertion,
      TSTypeAssertion: checkAssertion,
    };
  },
});
