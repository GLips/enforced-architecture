// ─── types/require-safety-comment ────────────────────────────────────
//
// Makes sure: Every type assertion carries a `SAFETY:` comment that names the
// invariant. `rg "SAFETY:"` returns each place where the code overrules the
// compiler, so an audit of the assertions is one search. When you change a
// type, the comment tells you what to check again.
//
// Keep one marker. A second spelling such as `// JUSTIFY:` reads as a small
// improvement, and it means no single search finds every assertion.
//
// One comment covers every assertion in the statement it sits above. That is
// deliberate: one justified statement split into two assertions must not cost
// two identical sentences. It also means `value as unknown as User` passes with
// one comment, so take `types/no-chained-type-assertions` with this rule.
//
// `as const` needs no comment. It narrows a literal the compiler already reads
// and cannot be wrong. Remove the carve-out and people write empty sentences.
// ──────────────────────────────────────────────────────────────────────

import { defineRule, type ESTree } from "@oxlint/plugins";
import { isArchitectureExemptPath } from "../lib/architecture-exempt-paths.ts";

type TypeAssertion = ESTree.TSAsExpression | ESTree.TSTypeAssertion;

const SAFETY_COMMENT = /\bSAFETY\s*:/u;

// The walk up stops once it has checked a node that sits directly in a statement list, so an
// assertion inside a call argument still finds a comment written above the statement containing the
// call. Without the stop, the search would run to Program and a comment above an unrelated earlier
// statement would count.
//
// Testing the PARENT rather than listing statement kinds is what makes `export const x = raw as T`
// work. An exported declaration is wrapped in an ExportNamedDeclaration, so the comment sits above
// the wrapper, not above the VariableDeclaration — a rule that stops at the declaration finds
// nothing and rejects every justified assertion on an exported binding. Every rule in this catalog
// is read against exported code, so that is the common case, not the edge.
const STATEMENT_LIST_PARENTS = new Set([
  "BlockStatement",
  "ClassBody",
  "Program",
  "StaticBlock",
  "SwitchCase",
  "TSModuleBlock",
]);

// `as const` is not an assertion about provenance — it narrows a literal the compiler can already
// see, and cannot be wrong. Asking for a justification would train people to write empty ones.
function isConstAssertion(node: TypeAssertion): boolean {
  return (
    node.typeAnnotation.type === "TSTypeReference" &&
    node.typeAnnotation.typeName.type === "Identifier" &&
    node.typeAnnotation.typeName.name === "const"
  );
}

export const requireSafetyCommentRule = defineRule({
  meta: {
    type: "problem",
    messages: {
      missingSafetyComment:
        "This type assertion states no reason. Add a `// SAFETY:` comment naming the invariant that makes it true — what was already checked, and where. If no such invariant exists, parse the value instead of asserting it.",
    },
  },
  create(context) {
    if (isArchitectureExemptPath(context.filename)) return {};

    function hasSafetyComment(node: TypeAssertion): boolean {
      let current: ESTree.Node = node;
      while (true) {
        const comments = context.sourceCode.getCommentsBefore(current);
        // `comment.end <= node.start` is load-bearing: getCommentsBefore on an outer node returns
        // comments before *that* node, which for a trailing same-line comment can sit after the
        // assertion itself. A justification written after the code it justifies is not one.
        if (comments.some((comment) => comment.end <= node.start && SAFETY_COMMENT.test(comment.value))) {
          return true;
        }
        const parent: ESTree.Node | null = current.parent;
        // `Program` is the one node with no parent, and it is in the set above — so the walk always
        // stops at an enclosing statement list before it can reach it. The null branch is how that
        // is stated to the compiler, not a case that runs.
        if (parent === null || STATEMENT_LIST_PARENTS.has(parent.type)) return false;
        current = parent;
      }
    }

    const checkAssertion = (node: TypeAssertion) => {
      if (isConstAssertion(node) || hasSafetyComment(node)) return;
      context.report({ node, messageId: "missingSafetyComment" });
    };

    return {
      TSAsExpression: checkAssertion,
      // The angle-bracket spelling is a different node for the same operation. A rule that visits
      // only TSAsExpression is bypassed by a syntax an agent picks for style reasons, not evasion.
      TSTypeAssertion: checkAssertion,
    };
  },
});
