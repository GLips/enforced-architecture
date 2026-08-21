// ─── types/no-known-value-widening ───────────────────────────────────
//
// Makes sure: A literal keeps the type TypeScript read from it. No annotation on
// a variable, a class property or a return replaces a literal's own keys with
// `unknown`, `any`, `object` or an open dictionary. So `handlers.stpo` is an
// error, the editor lists the keys, and `satisfies` checks the values without
// that loss.
//
// `Record<string, Handler>` reports although its value type is precise. The loss
// is in the KEYS. That surprises readers, and it is the point of the check — and
// it is the one line where this check and its two siblings must disagree.
// `openKeyDomainValueTypes` in `type-shapes.ts` answers "is this key domain
// open" for all three; this one stops there, so `Record<string, Handler>`
// reports here and is silent in `types/no-opaque-record` and
// `types/no-widen-then-assert`, which both go on to ask whether the VALUE is
// opaque too. Every fixture pins that row.
//
// A CLOSED key domain is not a widening. `Record<'start' | 'stop', Handler>`,
// `{ [K in keyof Config]: Handler }`, an enum and `(typeof KEYS)[number]` name
// exactly the keys the literal has, so they delete nothing and are legal — the
// same reading that keeps a dirty-field tracker legal in
// `types/no-opaque-record`.
//
// An empty object or array literal is legal. `const acc: Record<string, Handler>
// = {}` is an accumulator that gets the type it grows into, which is the one case
// where the annotation adds information.
//
// The value must be written AT the annotation. `const base = {…}; const h:
// Record<string, Handler> = base;` is missed on purpose, and so is any value from
// a call: `const x: unknown = parse(text)` is a boundary, not a widening.
// `types/no-widen-then-assert` is the check that follows a binding, and it does
// so only where an assertion afterwards makes the round trip pointless.
//
// A WRAPPED dictionary is still a dictionary. `Partial<Record<string, Handler>>`
// and `Readonly<Record<string, Handler>>` keep the index signature, so the key
// domain is open and the finding stands. A key domain that is FINITE IN FACT is
// silent however it is written — an imported alias, an imported enum, a
// conditional type, `Row['id']` — because the check reads the resolved type and
// not the spelling.
//
// NEGATIVE SPACE:
//   - An UNINSTANTIATED GENERIC annotation is silent; see `type-shapes.ts`.
//
// SCOPE: this is a TREE-SCOPED check. It walks the declared trees and the
// type-carrying files inside them, minus what `isArchitectureExemptSourcePath`
// names — tests, scripts, generated and ambient modules. Neither silence is
// coverage. It is also silent on any file its tree's tsconfig does not compile,
// which `assertTreeIsTypeChecked` turns into a loud failure rather than a quiet
// zero.
// ──────────────────────────────────────────────────────────────────────

import type { Finding, StructuralCheck, TreeContext } from "../check-context.ts";
import { SyntaxKind, type Node } from "../type-checker.ts";
import {
  enclosingFunctionLike,
  findingAtNode,
  NON_PRIMITIVE_TYPE_FLAGS,
  openKeyDomainValueTypes,
  treeSourceFiles,
  typeCheckableNodesOfKind,
  typeResolvesToFlags,
  UNTYPED_TYPE_FLAGS,
} from "./type-shapes.ts";

/**
 * Values whose precise type is visible in the source, so an annotation over one
 * can only subtract.
 *
 * A `CallExpression` is absent on purpose: a call's return type is not written
 * here, so an annotation over it can add information rather than delete it. An
 * `Identifier` is absent for the same reason one indirection further out.
 */
const SELF_EVIDENT_VALUE_KINDS: ReadonlySet<SyntaxKind> = new Set([
  SyntaxKind.ArrayLiteralExpression,
  SyntaxKind.ArrowFunction,
  SyntaxKind.BigIntLiteral,
  SyntaxKind.ClassExpression,
  SyntaxKind.FalseKeyword,
  SyntaxKind.FunctionExpression,
  SyntaxKind.NewExpression,
  SyntaxKind.NoSubstitutionTemplateLiteral,
  SyntaxKind.NumericLiteral,
  SyntaxKind.ObjectLiteralExpression,
  SyntaxKind.RegularExpressionLiteral,
  SyntaxKind.StringLiteral,
  SyntaxKind.TemplateExpression,
  SyntaxKind.TrueKeyword,
]);

/** The three places an annotation sits directly above a written value. */
const WIDENING_SITE_KINDS: ReadonlySet<SyntaxKind> = new Set([
  SyntaxKind.VariableDeclaration,
  SyntaxKind.PropertyDeclaration,
  SyntaxKind.ReturnStatement,
  SyntaxKind.ArrowFunction,
]);

export const noKnownValueWideningCheck: StructuralCheck = {
  id: "types/no-known-value-widening",
  scope: "tree",

  async run(context: TreeContext): Promise<Finding[]> {
    const treeChecker = await context.typeChecker();
    const findings: Finding[] = [];

    for (const file of await treeSourceFiles(context, treeChecker)) {
      const pairs: { value: Node; annotation: Node }[] = [];
      for (const site of typeCheckableNodesOfKind(file, WIDENING_SITE_KINDS)) {
        const pair = annotatedValueAt(site);
        if (pair !== undefined && isSelfEvidentValue(pair.value)) pairs.push(pair);
      }
      if (pairs.length === 0) continue;

      // Batched on the ANNOTATIONS, never on the values. The value is judged
      // syntactically — that is what "written here" means — and asking about an
      // expression is also where the 7.0.2 empty-tuple panic lives.
      const types = await treeChecker.checker.getTypeAtLocation(
        pairs.map((pair) => pair.annotation),
      );

      for (const [index, type] of types.entries()) {
        const pair = pairs[index];
        if (pair === undefined || type === undefined) continue;

        // Two sentences, because `satisfies` is only a fix for one of them.
        // `satisfies unknown` and `satisfies object` compile and check nothing —
        // prescribing them hands the reader an edit that keeps the loss and adds
        // a keyword, and it is the tag's own position that neither states a
        // contract.
        const dictionary = (await openKeyDomainValueTypes(treeChecker, type)) !== undefined;
        if (!dictionary && !(await isBroadKeyword(treeChecker, type))) continue;

        findings.push(
          findingAtNode(
            context,
            file,
            pair.value,
            "error",
            dictionary
              ? `This annotation discards what TypeScript already knew about the value — the ` +
                  `literal's own keys. Use \`satisfies ${pair.annotation.getText(file)}\` to ` +
                  `check the values without opening the key domain, or drop the annotation and ` +
                  `let inference do the work.`
              : `This annotation replaces everything TypeScript knew about the value with ` +
                  `\`${pair.annotation.getText(file)}\`, which states no contract. Drop it and ` +
                  `let inference do the work, or name the type the literal already has.`,
          ),
        );
      }
    }

    return findings;
  },
};

/** `unknown`, `any` or `object`, through a union or a transparent container. */
async function isBroadKeyword(
  treeChecker: Awaited<ReturnType<TreeContext["typeChecker"]>>,
  type: Parameters<typeof typeResolvesToFlags>[1],
): Promise<boolean> {
  return typeResolvesToFlags(treeChecker, type, UNTYPED_TYPE_FLAGS | NON_PRIMITIVE_TYPE_FLAGS);
}

/** The `(value, annotation)` pair at one site, when the site has both. */
function annotatedValueAt(site: Node): { value: Node; annotation: Node } | undefined {
  const node = site as Node & { type?: Node; initializer?: Node; expression?: Node; body?: Node };

  if (site.kind === SyntaxKind.ReturnStatement) {
    // The annotation belongs to the enclosing function, not to the statement.
    const fn = enclosingFunctionLike(site);
    const returnType = fn === undefined ? undefined : (fn as Node & { type?: Node }).type;
    return returnType !== undefined && node.expression !== undefined
      ? { value: node.expression, annotation: returnType }
      : undefined;
  }

  if (site.kind === SyntaxKind.ArrowFunction) {
    // A concise arrow body is a return with no `ReturnStatement` to visit.
    if (node.body === undefined || node.body.kind === SyntaxKind.Block) return undefined;
    return node.type === undefined
      ? undefined
      : { value: withoutParentheses(node.body), annotation: node.type };
  }

  return node.type !== undefined && node.initializer !== undefined
    ? { value: withoutParentheses(node.initializer), annotation: node.type }
    : undefined;
}

/**
 * The expression inside however many parentheses wrap it.
 *
 * Not cosmetic, and the concise arrow is why: `(): Bag => ({ a: 1 })` MUST
 * parenthesise its object literal or the braces parse as a block, so every
 * object returned from a concise arrow arrives here wrapped. A check that read
 * the outer node saw a `ParenthesizedExpression`, which is in no list of value
 * kinds, and the whole branch reported nothing while looking present.
 */
function withoutParentheses(value: Node): Node {
  let inner = value;
  while (inner.kind === SyntaxKind.ParenthesizedExpression) {
    const wrapped = (inner as Node & { expression?: Node }).expression;
    if (wrapped === undefined) break;
    inner = wrapped;
  }
  return inner;
}

/**
 * Whether the value carries its own type, and is not the one literal that does
 * not: an EMPTY object or array is an accumulator, and the annotation over it is
 * the only thing saying what it will hold.
 */
function isSelfEvidentValue(value: Node): boolean {
  if (!SELF_EVIDENT_VALUE_KINDS.has(value.kind)) return false;
  const literal = value as Node & { properties?: readonly Node[]; elements?: readonly Node[] };
  if (value.kind === SyntaxKind.ObjectLiteralExpression) {
    return (literal.properties?.length ?? 0) > 0;
  }
  if (value.kind === SyntaxKind.ArrayLiteralExpression) {
    return (literal.elements?.length ?? 0) > 0;
  }
  return true;
}
