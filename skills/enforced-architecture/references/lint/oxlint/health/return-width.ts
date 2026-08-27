// ─── health/return-width ──────────────────────────────────────────────
//
// Shows: Each LONG function that returns a WIDE object — `minLines` or
// more lines handing back `minMembers` or more members. That is a module
// wearing one function's name: several unrelated jobs done in one body and
// posted through one return, where the members are the exports it would
// have had.
//
// BOTH numbers, and the conjunction is the whole rule. Neither half means
// anything alone, and this was measured rather than assumed:
//
//   - Width alone is wrong. The widest return in the codebase this was
//     built against hands back 27 members from 32 lines, and it is a
//     design-token map — exactly the shape it should be. A marshaller, a
//     parsed-options record and a row mapper all look like this.
//
//   - Length alone belongs to somebody else. A long function returning one
//     value is what `health/cognitive-complexity` and
//     `health/accumulator-count` measure, from two different angles.
//
// It is the pair that names the thing: length says the body holds several
// jobs, width says nothing joined them but the `return`. Across two
// codebases the pair reports exactly two functions, and both are hooks that
// grew one handler at a time until they were a feature's whole API.
//
// The fix this asks for is not "return less". It is to find the group of
// members that move together, lift the code behind them into a function of
// its own, and call it — which the two reported functions each already do
// TWICE, for other groups. What the rule sees is the part that never got
// the same treatment.
//
// A `return` belongs to the innermost function around it, so a `return {…}`
// inside a `.map` callback is the callback's and not this function's. That
// is a narrower boundary than `health/cognitive-complexity` and
// `health/accumulator-count` use, deliberately: those two ask what a reader
// reads, and this one asks what the language returns.
//
// NEGATIVE SPACE:
//   - A spread counts as ONE member. `{ ...actions, refresh }` is two here
//     and can be any width at runtime. Following it would mean resolving a
//     value, which no per-file rule can do; counting it high would make the
//     number a guess. Two spreads and nothing else stays silent, and that
//     is a real hole rather than a decision the rule got right.
//   - A wide return TYPE is not measured. Only an object literal in a
//     `return` is, so a function handing back something built elsewhere is
//     silent — the width has to be visible in this file to be counted here.
//   - Many members with FEW lines is silent by construction, and that is
//     the case width-only rules get wrong.
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
  type FunctionNode,
} from "../lib/function-subjects.ts";
import { numericRuleOption } from "../lib/rule-options.ts";
import { withoutTransparentWrappers } from "../lib/transparent-wrappers.ts";

/**
 * Measured, not picked. Across roughly 2,600 functions in two codebases, 278 return an object
 * literal and two clear both numbers — the two hooks that had become their feature's whole API.
 * The pair is insensitive over a wide band: every threshold between (8, 120) and (12, 200) reports
 * the same two, which is what a number picked on one codebase has to be before it travels.
 */
const DEFAULT_MIN_MEMBERS = 10;
const DEFAULT_MIN_LINES = 150;

/** Members of the object this expression IS, or 0 when it is not an object literal. */
function objectLiteralWidth(expression: ESTree.Node): number {
  const value = withoutTransparentWrappers(expression);
  return value.type === "ObjectExpression" ? value.properties.length : 0;
}

/**
 * The widest object literal this function returns.
 *
 * Widest rather than summed or averaged: a function with one wide return and four narrow ones has
 * one wide surface, and the narrow returns are its early exits.
 */
function widestReturnedObject(fn: FunctionNode): number {
  // `const useThing = () => ({ a, b })` — a concise arrow body IS the returned expression.
  const body: ESTree.Node | null | undefined = fn.body;
  if (body === null || body === undefined) return 0;
  if (body.type !== "BlockStatement") return objectLiteralWidth(body);

  let widest = 0;
  const walk = (node: ESTree.Node) => {
    // Every function boundary, not just the named ones: a `return` inside a callback is the
    // callback's return. See the header for why this rule draws the line differently.
    if (isFunctionNode(node)) return;
    if (node.type === "ReturnStatement" && node.argument !== null) {
      const width = objectLiteralWidth(node.argument);
      if (width > widest) widest = width;
    }
    for (const child of childNodes(node)) walk(child);
  };

  walk(body);
  return widest;
}

export const returnWidthRule = defineTreeRule({
  meta: {
    type: "suggestion",
    schema: [
      {
        type: "object",
        properties: {
          minMembers: { type: "integer", minimum: 1 },
          minLines: { type: "integer", minimum: 1 },
        },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ minMembers: DEFAULT_MIN_MEMBERS, minLines: DEFAULT_MIN_LINES }],
    messages: {
      wideReturnFromLongBody:
        "{{name}} runs to {{lines}} lines and returns {{members}} members (thresholds: {{minLines}} lines, {{minMembers}} members). Those members are the exports a module would have had, and the body behind them is doing several jobs that nothing joins but this one `return`. Find the group that moves together — the members a caller uses in the same breath — lift the code behind them into its own function, and call it from here. A short function returning many members is a mapping and is not reported: it is the length that says these are separate jobs.",
    },
  },
  create(context) {
    const option = context.options[0];
    const minMembers = numericRuleOption(option, "minMembers", DEFAULT_MIN_MEMBERS);
    const minLines = numericRuleOption(option, "minLines", DEFAULT_MIN_LINES);

    return {
      Program(program) {
        for (const fn of functionSubjects(program)) {
          const lines = fn.loc.end.line - fn.loc.start.line + 1;
          if (lines < minLines) continue;

          const members = widestReturnedObject(fn);
          if (members < minMembers) continue;

          const { name, target } = functionSubjectName(fn);
          context.report({
            node: target,
            messageId: "wideReturnFromLongBody",
            data: {
              name,
              lines: String(lines),
              members: String(members),
              minLines: String(minLines),
              minMembers: String(minMembers),
            },
          });
        }
      },
    };
  },
});
