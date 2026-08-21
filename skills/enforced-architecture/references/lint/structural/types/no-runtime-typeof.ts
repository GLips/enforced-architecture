// ─── types/no-runtime-typeof ─────────────────────────────────────────
//
// Makes sure: No branch decides what an UNTYPED value is from its representation
// in memory. A `typeof` test over `unknown`, `any` or `object` is a parser
// written inline, so when the shape of that input changes you edit one branch in
// one file and every other reader of the same payload keeps its old assumption.
// Put the test in a named guard or a schema, and every caller narrows through it.
//
// ── Scoped to the UNTYPED operand ────────────────────────────────────
//
// A tier with no type information cannot ask whether the operand is `unknown` or
// `string | number`, so the only rule it can state is a ban on EVERY runtime
// `typeof` outside a type guard — a tooling limit rather than a position, and one
// that reports correct code: the SSR guard, and the discrimination of a union the
// compiler has already narrowed. A check written that way owes its adopters a
// warning to expect per-line disables.
//
// This check has a checker, so it states the position instead: a `typeof` is a
// violation when the operand HAS no type, and ordinary control flow when it has
// one.
//
// Two silences follow, and both are deliberate:
//   - `typeof window === "undefined"` does not report. `window` is
//     `Window & typeof globalThis`, which is a type; the guard is asking about
//     existence, not shape.
//   - `typeof value === "string"` over `string | number` does not report. That is
//     the compiler's own narrowing mechanism, and a check that reports it is
//     reporting correct code.
//
// A project that wants the total ban does not get it by configuring this check —
// there is no knob and there was never going to be one. It gets it by not
// writing `typeof`.
//
// The type-guard exemption stays, and it is what makes the check actionable: the
// fix for a reported `typeof` is to move it into a function that returns
// `value is T`, at which point the same test is the parse step rather than a
// branch. `typePredicateSubjects` in `type-shapes.ts` owns what a guard is, and
// `types/no-broad-parameters` reads the same answer to exempt the value that
// guard vouches for — so one check cannot demand the signature the other reports.
//
// NEGATIVE SPACE:
//   - `typeof` over a GENERIC parameter is silent. `T` is a type parameter, not
//     `unknown`, even where every call site instantiates it broadly.
//   - The type-level `typeof X` in a type position is a different operator and is
//     never a subject.
//   - Nothing here reads WHAT the test compares against, so `typeof v ===
//     "sting"` is a typo this check does not catch. `typescript/no-unnecessary-
//     condition` is the near neighbour and is deliberately off; see the `types`
//     section of the shipped `oxlintrc.json`.
//
// SCOPE: this is a TREE-SCOPED check. It walks the declared trees and the
// type-carrying files inside them, minus what `isArchitectureExemptSourcePath`
// names — tests, scripts, generated and ambient modules. Neither silence is
// coverage. It is also silent on any file its tree's tsconfig does not compile,
// which `assertTreeIsTypeChecked` turns into a loud failure rather than a quiet
// zero.
// ──────────────────────────────────────────────────────────────────────

import type { Finding, StructuralCheck, TreeContext } from "../check-context.ts";
import { SyntaxKind, type Node, type Type } from "../type-checker.ts";
import {
  declaresTypePredicate,
  enclosingFunctionLike,
  findingAtNode,
  isTypeRequestUnsafe,
  NON_PRIMITIVE_TYPE_FLAGS,
  treeSourceFiles,
  typeCheckableNodesOfKind,
  UNTYPED_TYPE_FLAGS,
} from "./type-shapes.ts";

const RUNTIME_TYPEOF_MESSAGE =
  "This `typeof` decides what an untyped value is from its representation — a string is not yet " +
  "a UserId. Parse the value at its I/O boundary, or move this test into a function returning " +
  "`value is T` so every caller narrows through one contract.";

const TYPEOF_KINDS: ReadonlySet<SyntaxKind> = new Set([SyntaxKind.TypeOfExpression]);

export const noRuntimeTypeofCheck: StructuralCheck = {
  id: "types/no-runtime-typeof",
  scope: "tree",

  async run(context: TreeContext): Promise<Finding[]> {
    const treeChecker = await context.typeChecker();
    const findings: Finding[] = [];

    for (const file of await treeSourceFiles(context, treeChecker)) {
      const tests: { node: Node; operand: Node }[] = [];
      for (const node of typeCheckableNodesOfKind(file, TYPEOF_KINDS)) {
        const operand = (node as Node & { expression?: Node }).expression;
        if (operand === undefined || isTypeRequestUnsafe(operand)) continue;
        if (await isInsideTypeGuard(treeChecker, node)) continue;
        tests.push({ node, operand });
      }
      if (tests.length === 0) continue;

      const types = await treeChecker.checker.getTypeAtLocation(tests.map((test) => test.operand));
      for (const [index, type] of types.entries()) {
        const test = tests[index];
        if (test === undefined || type === undefined) continue;
        if (!isUntypedOperand(type)) continue;
        findings.push(findingAtNode(context, file, test.node, "error", RUNTIME_TYPEOF_MESSAGE));
      }
    }

    return findings;
  },
};

/**
 * Whether the operand ITSELF is `unknown`, `any` or `object`.
 *
 * Deliberately NOT `typeResolvesToFlags`, which is the tag's shared reading and
 * is wrong here in both of its transparent steps. A container of nothing is
 * still nothing at a call site, so `Promise<unknown>` is a broad RETURN — but
 * `typeof xs` where `xs: unknown[]` is statically `"object"` and decides nothing
 * about untypedness. A union is broad when any member is, for the same call-site
 * reason — but `typeof v` over `object | string` is the compiler's own narrowing,
 * which this check exists to stop reporting. Sharing the helper here would report
 * both.
 *
 * The error type is excluded: an unresolved name carries `Any`, and reporting it
 * blames the author for a broad annotation they did not write.
 */
function isUntypedOperand(type: Type): boolean {
  if (type.isErrorType()) return false;
  return (type.flags & (UNTYPED_TYPE_FLAGS | NON_PRIMITIVE_TYPE_FLAGS)) !== 0;
}

/**
 * Whether the NEAREST enclosing function returns a type predicate.
 *
 * The nearest one, not any of them: a callback inside a guard has its own
 * signature and its own (absent) predicate, so a `typeof` there is not covered
 * by the outer guard's contract and still reports.
 */
async function isInsideTypeGuard(
  treeChecker: Awaited<ReturnType<TreeContext["typeChecker"]>>,
  node: Node,
): Promise<boolean> {
  const fn = enclosingFunctionLike(node);
  if (fn === undefined) return false;
  return declaresTypePredicate(treeChecker, fn);
}
