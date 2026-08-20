// ─── types/require-safety-comment ────────────────────────────────────
//
// Tag:      types
// Mechanism: oxlint JS plugin (per-file, real-time)
// Blocking: Yes
//
// Prevents: Type assertions (`value as User`, `<User>value`) that state
//           no reason. The assertion is not banned — it is made to cost
//           a sentence. Every one must carry a `SAFETY:` comment naming
//           the invariant the compiler cannot see.
//
//           This is the catalog's one rule built on a different
//           mechanism from the rest. Every other rule makes the wrong
//           thing inexpressible; this one leaves the escape hatch open
//           and makes using it leave a trace. That fits assertions
//           specifically, because a small number of them are correct
//           and no per-file rule can tell which.
//
//           It works on an agent for a reason worth stating: an
//           assertion is how a model answers a compiler error it does
//           not understand, and it is invisible in review because it
//           looks like a decision. Forcing the justification either
//           produces a real invariant — at which point the assertion is
//           probably fine — or produces a sentence whose weakness is
//           legible to a human reading the diff. A bare `as User` says
//           nothing either way.
//
// Excludes: `as const`, which widens nothing and asserts nothing about
//           a value's provenance, and `satisfies`, which is checked.
//
// Applies:  All .ts and .tsx files EXCEPT:
//           - Test files and scripts
//
// Error:    "This type assertion states no reason. Add a `// SAFETY:`
//            comment naming the invariant that makes it true — what was
//            already checked, and where. If no such invariant exists,
//            parse the value instead of asserting it."
//
// ── Adapt ─────────────────────────────────────────────────────────────
//
// 1. The marker — `SAFETY_COMMENT`:
//    `SAFETY:` is borrowed from Rust's `unsafe` convention, where it
//    carries the same meaning: the compiler has stopped checking, so
//    the author states what holds instead. Any marker works as long as
//    it is greppable — `// JUSTIFY:`, `// CHECKED:`. Pick one and hold
//    it, because two spellings means neither can be audited with a
//    single search. Auditing the escape hatch is most of the value:
//    `rg "SAFETY:"` is the list of every place the type system was
//    overruled.
//
// 2. How far up the comment may sit — `COMMENT_OWNER_KINDS`:
//    The comment is looked for immediately above the assertion, then
//    above each enclosing node up to the containing statement. That is
//    what lets one comment cover an assertion buried in a call argument
//    or a ternary branch, where there is no line of its own to sit on.
//    It also means one comment covers *every* assertion in that
//    statement — deliberate, since splitting one justified statement
//    into two assertions should not cost two identical comments. A
//    project wanting one comment per assertion narrows this set.
//
// 3. Pairing — this rule has a known bypass on its own:
//    `value as unknown as User` satisfies it with one comment for a
//    double assertion that discards more evidence than either half
//    admits. Adopt `types/no-chained-type-assertions` alongside it, or
//    the escape hatch has its own escape hatch.
//
// 4. File scope — `isArchitectureExemptPath`:
//    Tests and scripts are exempt through `../lib/architecture-exempt-paths.ts`.
//    A test builds fixtures that are deliberately partial, and making
//    it narrate each one produces noise, not evidence.
//
// 5. Registration:
//    Add the rule to the project's oxlint plugin
//    (`rules: { "require-safety-comment": requireSafetyCommentRule }`)
//    and turn it on in `.oxlintrc.json`
//    (`"<plugin>/require-safety-comment": "error"`).
//
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
