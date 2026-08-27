// ─── health/cognitive-complexity ──────────────────────────────────────
//
// Shows: Each function whose control flow costs a reader more than
// `threshold` to follow, and the number. Not how many paths it has —
// how much a reader has to hold to reach the end of one. A flat
// twelve-case switch is one thing to understand; three ifs inside a loop
// inside an if are not.
//
// The scoring is SonarSource's cognitive complexity with three
// adjustments, each measured against hand-labelled functions in two real
// codebases rather than argued from the paper. All three are subtractive:
// they leave every genuinely hard function where it was and drop the
// shapes the stock metric charges for being written well.
//
//   1. A function boundary adds no nesting. Stock charges the contents of
//      a callback for the depth of the callback itself, so a body written
//      inside `withTransaction(() => …)` scores as though it were nested
//      under an `if`. The reader's stack does not grow there: the wrapper
//      is one line of context, not a branch to remember.
//
//   2. A guard clause costs a flat +1. `if (bad) return` removes a case
//      instead of nesting one, and the reader's stack is SHORTER after it.
//      Stock charges it the nesting penalty of the `if` it is not.
//
//   3. Only ANONYMOUS callbacks roll into the enclosing function. Stock
//      folds every nested function's score into its parent, so a file that
//      factors its work into named helpers scores as though it had not.
//      What a name buys is exactly the thing being measured. See
//      `lib/function-subjects.ts` — `health/accumulator-count` reads the
//      same answer, so the two numbers describe one function.
//
// It warns and does not fail the build, for the reason `react/hook-count`
// does: a parser, a diff and a scheduler are genuinely this shape, and the
// number is what a reader uses to decide what to split, not a verdict that
// something is wrong.
//
// NEGATIVE SPACE, and this is the case that survives all three
// adjustments: a long chain of uniform guard clauses inside a loop still
// reports. Fourteen one-line `if (…) continue` in two `for` loops reads
// straight through and scores over any threshold worth setting, because
// nothing in a control-flow metric can see that fourteen branches are the
// SAME branch. Uniformity is what the metric cannot measure; adjustment 2
// makes such a function cheaper without making it free.
//
// Nothing here counts state. A function whose branches are shallow and
// whose accumulators are many scores low and is hard for the other
// reason — `health/accumulator-count` is that number, and neither rule
// subsumes the other.
//
// SCOPE, from the wrapper rather than from anything below: silent outside
// the declared trees, and on the test, script, generated and ambient files
// `isArchitectureExemptSourcePath` names inside them. Neither silence is
// coverage.
// ──────────────────────────────────────────────────────────────────────

import { defineTreeRule } from "../lib/define-tree-rule.ts";
import { type ESTree } from "@oxlint/plugins";
import {
  childNodes,
  functionSubjectName,
  functionSubjects,
  isFunctionNode,
  isNamedHelper,
  type FunctionNode,
} from "../lib/function-subjects.ts";
import { numericRuleOption } from "../lib/rule-options.ts";

/**
 * SonarSource's default is 15, and it is set against the UNADJUSTED metric. Every adjustment above
 * lowers scores, so the same 15 here would report a wider set than Sonar's own — measured on two
 * codebases it reports about one function in fifty, which is a warning nobody clears. 20 is where
 * the list is short enough to read end to end and every entry is a function somebody would look at.
 */
const DEFAULT_THRESHOLD = 20;

/** The statements that END a path rather than continuing one, which is what makes a guard a guard. */
const JUMP_TYPES = new Set([
  "ReturnStatement",
  "ThrowStatement",
  "BreakStatement",
  "ContinueStatement",
]);

/**
 * A guard clause: `if (bad) return`, and the two-statement form that logs or records before leaving.
 *
 * An `else` disqualifies it — that is a fork, and both sides are live after it. The two-statement
 * ceiling is deliberately low: past that the block is work rather than an exit, and charging it as
 * an exit hands out a way to write a nested branch that costs nothing.
 */
function isGuardClause(node: ESTree.IfStatement): boolean {
  if (node.alternate !== null) return false;

  const consequent = node.consequent;
  if (JUMP_TYPES.has(consequent.type)) return true;
  if (consequent.type !== "BlockStatement") return false;

  const statements = consequent.body;
  if (statements.length === 0 || statements.length > 2) return false;
  return JUMP_TYPES.has(statements[statements.length - 1].type);
}

/** `else if` continues a chain the eye reads as a list; a nested `if` opens a level. */
function isElseIf(node: ESTree.IfStatement): boolean {
  const parent: ESTree.Node | null | undefined = node.parent;
  return parent?.type === "IfStatement" && parent.alternate === node;
}

const LOOPING_TYPES = new Set([
  "SwitchStatement",
  "ForStatement",
  "ForInStatement",
  "ForOfStatement",
  "WhileStatement",
  "DoWhileStatement",
  "CatchClause",
]);

function cognitiveComplexity(fn: FunctionNode): number {
  let score = 0;

  const charge = (nesting: number, withNesting: boolean) => {
    score += withNesting ? 1 + nesting : 1;
  };

  /**
   * A run of one operator is one thing to understand, however long: `a && b && c` is +1. Changing
   * operator is what costs — `a && b || c` is +2, because the reader has to re-establish precedence.
   */
  const chargeLogicalChain = (node: ESTree.Node, nesting: number) => {
    let previous: string | undefined;
    const flatten = (n: ESTree.Node) => {
      if (n.type === "ParenthesizedExpression") return flatten(n.expression);
      if (n.type === "LogicalExpression") {
        flatten(n.left);
        if (n.operator !== previous) {
          score += 1;
          previous = n.operator;
        }
        flatten(n.right);
        return;
      }
      // A ternary or a call inside the condition is still flow to charge for.
      walk(n, nesting);
    };
    flatten(node);
  };

  const walkChildren = (node: ESTree.Node, nesting: number) => {
    for (const child of childNodes(node)) walk(child, nesting);
  };

  const walk = (node: ESTree.Node, nesting: number) => {
    // Adjustment 3, and adjustment 1 is the `nesting` passed through unchanged rather than +1.
    if (isFunctionNode(node)) {
      if (isNamedHelper(node)) return;
      walkChildren(node, nesting);
      return;
    }

    if (node.type === "IfStatement") {
      // Adjustment 2. The condition is still charged: `if (a && b) return` is two things to check.
      if (isGuardClause(node)) {
        charge(nesting, false);
        chargeLogicalChain(node.test, nesting);
        walk(node.consequent, nesting);
        return;
      }

      charge(nesting, !isElseIf(node));
      chargeLogicalChain(node.test, nesting);
      walk(node.consequent, nesting + 1);

      if (node.alternate === null) return;
      if (node.alternate.type === "IfStatement") {
        walk(node.alternate, nesting);
      } else {
        charge(nesting, false);
        walk(node.alternate, nesting + 1);
      }
      return;
    }

    if (node.type === "ConditionalExpression") {
      charge(nesting, true);
      chargeLogicalChain(node.test, nesting);
      walk(node.consequent, nesting + 1);
      walk(node.alternate, nesting + 1);
      return;
    }

    if (LOOPING_TYPES.has(node.type)) {
      charge(nesting, true);
      walkChildren(node, nesting + 1);
      return;
    }

    // A labelled jump leaves for somewhere the reader has to go and find. A bare one does not.
    if (
      (node.type === "BreakStatement" || node.type === "ContinueStatement") &&
      node.label !== null
    ) {
      charge(nesting, false);
      return;
    }

    if (node.type === "LogicalExpression") {
      chargeLogicalChain(node, nesting);
      return;
    }

    walkChildren(node, nesting);
  };

  const body: ESTree.Node | null | undefined = fn.body;
  if (body !== null && body !== undefined) walk(body, 0);
  return score;
}

export const cognitiveComplexityRule = defineTreeRule({
  meta: {
    type: "suggestion",
    schema: [
      {
        type: "object",
        properties: { threshold: { type: "integer", minimum: 1 } },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ threshold: DEFAULT_THRESHOLD }],
    messages: {
      tooComplex:
        "{{name}} scores {{score}} for control flow (threshold: {{threshold}}) — that is how much a reader holds to follow ONE path through it, not how many paths there are. Look for a section that could be a named function: a scoring pass, a validation pass, a normalisation step. Naming it takes its score out of this one, because a name is somewhere a reader arrives on purpose. If the branches are genuinely one decision spread over many lines, a lookup table moves them out of the control flow entirely. This warns rather than fails: a parser or a scheduler is legitimately this shape.",
    },
  },
  create(context) {
    const threshold = numericRuleOption(context.options[0], "threshold", DEFAULT_THRESHOLD);

    return {
      Program(program) {
        for (const fn of functionSubjects(program)) {
          const score = cognitiveComplexity(fn);
          if (score < threshold) continue;

          const { name, target } = functionSubjectName(fn);
          context.report({
            node: target,
            messageId: "tooComplex",
            data: { name, score: String(score), threshold: String(threshold) },
          });
        }
      },
    };
  },
});
