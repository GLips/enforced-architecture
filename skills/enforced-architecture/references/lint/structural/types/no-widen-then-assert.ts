// ─── types/no-widen-then-assert ──────────────────────────────────────
//
// Makes sure: A value with a known type keeps that type to the end of the
// function. No step assigns it to `unknown`, `object` or an open opaque `Record`
// and then asserts the type back with nothing checked between the two. So when
// you change a field on `User`, the compiler reports each use; the two steps
// cannot hold the old type in place.
//
// `types/require-safety-comment` does not cover this flow. It fires on the same
// line, and the compliant answer there is `// SAFETY: stored came from loaded,
// which is a User` — a true sentence that keeps both steps and silences the
// linter for good. Take the safety check alone and prose becomes the cheapest
// fix. The two are jointly actionable: deleting the widening clears both.
//
// Both steps must sit in the same function, and the assertion must come after
// the widening. Across a closure the two lines have different authors, and a
// check that called that flow pointless would be guessing.
//
// What counts as an open opaque dictionary is `type-shapes.ts`'s answer, so this
// cannot drift from `types/no-opaque-record` on which spellings are bags or on
// `object` as a value. `types/no-known-value-widening` reads only the KEY half of
// that answer, which is why `Record<string, Handler>` reports there and is silent
// here: a dictionary with a precise value type is evidence of a known type, not a
// widening.
//
// A CALL is evidence, because the checker reads its return type. `const user:
// unknown = loadUser()` where `loadUser` returns `User` is a widening and
// reports; `const parsed: unknown = JSON.parse(text)` is not, because `JSON.parse`
// returns `any` and there was no known type to lose. Which of the two a given
// call is, is a fact here rather than a guess from its name.
//
// NEGATIVE SPACE:
//   - The widened binding must be a `const`. A `let` reassigned between the two
//     steps is not a flow this check can reason about: the value at the assertion
//     may not be the value that was widened.
//   - The asserted expression must be a plain identifier. `(f() as unknown) as
//     User` has no binding to follow and is `types/no-chained-type-assertions`'
//     subject.
//   - Widening through a PARAMETER is silent. `function f(x: unknown)` is
//     `types/no-broad-parameters`' finding, at the declaration, and reporting the
//     assertion too would prescribe an edit the caller has to make.
//
// SCOPE: this is a TREE-SCOPED check. It walks the declared trees and the
// type-carrying files inside them, minus what `isArchitectureExemptSourcePath`
// names — tests, scripts, generated and ambient modules. Neither silence is
// coverage. It is also silent on any file its tree's tsconfig does not compile,
// which `assertTreeIsTypeChecked` turns into a loud failure rather than a quiet
// zero.
// ──────────────────────────────────────────────────────────────────────

import type { Finding, StructuralCheck, TreeContext } from "../check-context.ts";
import { NodeFlags, SyntaxKind, type Node, type Type } from "../type-checker.ts";
import {
  enclosingFunctionLike,
  findingAtNode,
  isOpaqueDictionary,
  isTypeRequestUnsafe,
  NON_PRIMITIVE_TYPE_FLAGS,
  treeSourceFiles,
  typeCheckableNodesOfKind,
  typeResolvesToFlags,
  UNTYPED_TYPE_FLAGS,
} from "./type-shapes.ts";

const ASSERTION_KINDS: ReadonlySet<SyntaxKind> = new Set([
  SyntaxKind.AsExpression,
  SyntaxKind.TypeAssertionExpression,
]);

export const noWidenThenAssertCheck: StructuralCheck = {
  id: "types/no-widen-then-assert",
  scope: "tree",

  async run(context: TreeContext): Promise<Finding[]> {
    const treeChecker = await context.typeChecker();
    const findings: Finding[] = [];

    for (const file of await treeSourceFiles(context, treeChecker)) {
      for (const assertion of typeCheckableNodesOfKind(file, ASSERTION_KINDS)) {
        const parts = assertion as Node & { expression?: Node; type?: Node };
        const subject = parts.expression;
        const asserted = parts.type;
        if (subject?.kind !== SyntaxKind.Identifier || asserted === undefined) continue;

        // A recovery, or another widening? Asked first because it is the cheapest
        // way to drop the majority of assertions in any real file.
        const assertedType = await treeChecker.checker.getTypeAtLocation(asserted);
        if (assertedType === undefined) continue;
        if (await isBroadType(treeChecker, assertedType)) continue;

        const declaration = await widenedConstDeclaration(treeChecker, subject);
        if (declaration === undefined) continue;
        if (!sameFunction(declaration, assertion)) continue;

        const declaredType = (declaration as Node & { type?: Node }).type;
        const initializer = (declaration as Node & { initializer?: Node }).initializer;
        if (initializer === undefined) continue;

        const widening = await wideningTypeOf(treeChecker, declaredType, initializer);
        if (widening === undefined) continue;

        // The value that was widened. When the widening is spelled `const x = v
        // as unknown`, that is `v`; when it is spelled `const x: unknown = v`, it
        // is the initializer itself.
        const original = widening.throughAssertion
          ? ((initializer as Node & { expression?: Node }).expression ?? initializer)
          : initializer;
        if (isTypeRequestUnsafe(original)) continue;

        const originalType = await treeChecker.checker.getTypeAtLocation(original);
        if (originalType === undefined) continue;
        // No evidence: the value was never known, so widening it discarded
        // nothing. This is what keeps `const raw: unknown = JSON.parse(s)` silent
        // — `JSON.parse` returns `any`, so there was nothing to preserve.
        if (await isBroadType(treeChecker, originalType)) continue;

        const name = (subject as Node & { text?: string }).text ?? "this value";
        findings.push(
          findingAtNode(
            context,
            file,
            assertion,
            "error",
            `\`${name}\` had a known type, discarded it, and this assertion invents it back. ` +
              `Nothing was checked in between. Delete the widening and keep the original type ` +
              `through to here.`,
          ),
        );
      }
    }

    return findings;
  },
};

/** `unknown`, `any`, `object`, or an open dictionary with an opaque value. */
async function isBroadType(
  treeChecker: Awaited<ReturnType<TreeContext["typeChecker"]>>,
  type: Type,
): Promise<boolean> {
  const flags = UNTYPED_TYPE_FLAGS | NON_PRIMITIVE_TYPE_FLAGS;
  if (await typeResolvesToFlags(treeChecker, type, flags)) return true;
  return isOpaqueDictionary(treeChecker, type);
}

/**
 * Which of the two spellings of the widening this declaration uses, or
 * `undefined` when it is not one.
 *
 * `const x: unknown = v` and `const x = v as unknown` are the same step, and a
 * check that read only the annotation would miss half of them.
 */
async function wideningTypeOf(
  treeChecker: Awaited<ReturnType<TreeContext["typeChecker"]>>,
  declaredType: Node | undefined,
  initializer: Node,
): Promise<{ throughAssertion: boolean } | undefined> {
  if (declaredType !== undefined) {
    const type = await treeChecker.checker.getTypeAtLocation(declaredType);
    if (type !== undefined && (await isBroadType(treeChecker, type))) {
      return { throughAssertion: false };
    }
  }
  if (!ASSERTION_KINDS.has(initializer.kind) || isTypeRequestUnsafe(initializer)) return undefined;
  const assertedNode = (initializer as Node & { type?: Node }).type;
  if (assertedNode === undefined) return undefined;
  const type = await treeChecker.checker.getTypeAtLocation(assertedNode);
  if (type === undefined || !(await isBroadType(treeChecker, type))) return undefined;
  return { throughAssertion: true };
}

/**
 * The `const` declaration the identifier resolves to, or `undefined`.
 *
 * `const` is the whole gate, and it carries the ordering too. A `let` reassigned
 * between the two steps is refused rather than guessed at — the value at the
 * assertion may not be the value that was widened — and a `const` cannot be used
 * before its declaration in code that compiles, so there is no separate position
 * comparison here and no arity check: a `const` has exactly one declaration.
 */
async function widenedConstDeclaration(
  treeChecker: Awaited<ReturnType<TreeContext["typeChecker"]>>,
  identifier: Node,
): Promise<Node | undefined> {
  const symbol = await treeChecker.checker.getSymbolAtLocation(identifier);
  const declaration = await symbol?.declarations?.[0]?.resolve();
  if (declaration?.kind !== SyntaxKind.VariableDeclaration) return undefined;
  if ((declaration.parent.flags & NodeFlags.Const) === 0) return undefined;
  return declaration;
}

/**
 * Whether two nodes sit in the same function body.
 *
 * Compared by POSITION rather than by object identity. A declaration reached
 * through a `NodeHandle` is resolved from the program's own source-file cache,
 * and nothing guarantees it is the same object the walk produced — an identity
 * test that silently answers `false` would turn this check off with no sign.
 */
function sameFunction(a: Node, b: Node): boolean {
  const fnA = enclosingFunctionLike(a);
  const fnB = enclosingFunctionLike(b);
  if (fnA === undefined || fnB === undefined) return fnA === fnB;
  return (
    fnA.pos === fnB.pos &&
    fnA.end === fnB.end &&
    fnA.getSourceFile().fileName === fnB.getSourceFile().fileName
  );
}
