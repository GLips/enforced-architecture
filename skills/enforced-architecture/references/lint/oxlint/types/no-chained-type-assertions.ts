// ─── types/no-chained-type-assertions ────────────────────────────────
//
// Makes sure: No assertion routes through `unknown` to reach its target, in the
// `as`, the angle-bracket or the mixed spelling. Each assertion keeps the one
// check TypeScript still makes: the two types must overlap. So when you change
// a field on `User` and the source type no longer overlaps, the compiler
// reports the assertion. A chain through `unknown` still compiles.
//
// A chain of only `as const` links is legal. Those narrow literals and claim
// nothing about where a value came from. One non-const link anywhere in the
// chain reports the whole chain.
//
// The split spelling is invisible here. `const b: unknown = a; const c = b as T`
// is the same claim across two statements, and the assertions are not nested.
// `types/no-widen-then-assert` reads that flow; neither rule covers the other.
// ──────────────────────────────────────────────────────────────────────

import { defineRule, type ESTree } from "@oxlint/plugins";
import { classifyFileRole } from "../../policy/declared-trees.ts";

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
    if (classifyFileRole(context.filename) === undefined) return {};

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
