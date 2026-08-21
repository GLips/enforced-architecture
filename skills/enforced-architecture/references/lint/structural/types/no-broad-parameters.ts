// ─── types/no-broad-parameters ───────────────────────────────────────
//
// Makes sure: Every parameter names what it accepts. No input is `unknown` or
// `any`, so no body outside a type guard reads a value it has to check first.
// No input is `object`, so no property read needs a cast, and a wrong argument
// fails at the call site rather than inside the function.
//
// A parameter named `cause` is exempt. A `catch` binding is `unknown`, so the
// value passed to `new Error(msg, { cause })` has no type to name. The exemption
// is by name and not by position, so it stays greppable. Keep
// `ALLOWED_UNKNOWN_PARAMETER_NAMES` short: each entry is a place where the type
// system gives no help.
//
// The value a type guard vouches for is exempt too — the subject of `value is
// InvoiceId` or `asserts value is InvoiceId`. A guard exists to give a type to
// input that has none, so demanding one is asking for the answer as the
// question; `types/no-runtime-typeof` tells you to write exactly this signature.
// That exemption is a fact about the return annotation, not a list, so it is not
// configurable. It reaches ONLY the parameters the predicates name: a second
// broad input on a guard still reports, and a predicate over `this` vouches for
// the receiver, which is not a parameter, so it exempts none. `type-shapes.ts`
// owns the reading and `types/no-runtime-typeof` shares it, so the two checks
// cannot disagree about what a guard is.
//
// The check bans `unknown` on INPUTS, not the type itself. A parser
// (`parseInvoice(input: unknown): Invoice`) is the signature the rest of this tag
// asks for, and its parameter still reports. Write the check as a guard or an
// assertion and the predicate exemption covers it. No directory silences this
// check, and the vocabulary names none for it.
//
// NEGATIVE SPACE:
//   - A parameter with NO annotation is silent. It is implicitly `any` under a
//     loose tsconfig, which is `noImplicitAny`'s complaint and stated better
//     there; under `strict` it is already a compile error.
//   - A DESTRUCTURED parameter is judged as one subject. `({ a, b }: unknown)`
//     reports once, and the finding names the pattern rather than a field.
//   - The shipped `typescript/no-unsafe-argument` is NOT this check with a
//     different name: it reports an `any` VALUE arriving at a typed parameter,
//     the exact mirror. Neither can see the other's case. See the `types` section
//     of the shipped `oxlintrc.json`.
//
// SCOPE: this is a TREE-SCOPED check. It walks the declared trees and the
// type-carrying files inside them, minus what `isArchitectureExemptSourcePath`
// names — tests, scripts, generated and ambient modules. Neither silence is
// coverage. It is also silent on any file its tree's tsconfig does not compile,
// which `assertTreeIsTypeChecked` turns into a loud failure rather than a quiet
// zero.
// ──────────────────────────────────────────────────────────────────────

import type { Finding, StructuralCheck, TreeContext } from "../check-substrate.ts";
import { SyntaxKind, type Node, type SourceFile } from "../type-checker.ts";
import {
  findingAtNode,
  FUNCTION_LIKE_KINDS,
  NON_PRIMITIVE_TYPE_FLAGS,
  treeSourceFiles,
  typeCheckableNodesOfKind,
  typePredicateSubjects,
  typeResolvesToFlags,
  UNTYPED_TYPE_FLAGS,
} from "./type-shapes.ts";

// `catch` binds `unknown`, so the value forwarded into an Error's `cause`
// genuinely has no type to name. Exempting by parameter name rather than by
// position keeps the hole searchable.
const ALLOWED_UNKNOWN_PARAMETER_NAMES = new Set(["cause"]);

export const noBroadParametersCheck: StructuralCheck = {
  id: "types/no-broad-parameters",
  scope: "tree",

  async run(context: TreeContext): Promise<Finding[]> {
    const treeChecker = await context.typeChecker();
    const findings: Finding[] = [];

    for (const file of await treeSourceFiles(context, treeChecker)) {
      for (const fn of typeCheckableNodesOfKind(file, FUNCTION_LIKE_KINDS)) {
        const parameters = (fn as Node & { parameters?: readonly Node[] }).parameters ?? [];
        const annotated = parameters.filter(
          (parameter) => (parameter as Node & { type?: Node }).type !== undefined,
        );
        if (annotated.length === 0) continue;

        // Asked once per function rather than once per parameter, and only for a
        // function that HAS a broad parameter to exempt — resolving a symbol's
        // declarations is a round trip, and most functions have neither.
        const vouchedFor = await typePredicateSubjects(treeChecker, fn);

        const annotations = annotated.map((parameter) => (parameter as Node & { type: Node }).type);
        const types = await treeChecker.checker.getTypeAtLocation(annotations);

        for (const [index, type] of types.entries()) {
          const parameter = annotated[index];
          const annotation = annotations[index];
          if (parameter === undefined || annotation === undefined || type === undefined) continue;

          const name = parameterName(file, parameter);
          if (vouchedFor.has(name)) continue;

          if (await typeResolvesToFlags(treeChecker, type, UNTYPED_TYPE_FLAGS)) {
            if (ALLOWED_UNKNOWN_PARAMETER_NAMES.has(name)) continue;
            findings.push(
              findingAtNode(
                context,
                file,
                annotation,
                "error",
                `Parameter \`${name}\` accepts a value without saying what it is. Name the type ` +
                  `the caller already has; run the schema or parser at the I/O boundary instead ` +
                  `of pushing \`unknown\` inward.`,
              ),
            );
            continue;
          }

          if (await typeResolvesToFlags(treeChecker, type, NON_PRIMITIVE_TYPE_FLAGS)) {
            findings.push(
              findingAtNode(
                context,
                file,
                annotation,
                "error",
                `Parameter \`${name}\` uses the broad \`object\` type, which admits every ` +
                  `non-primitive and supports no property read without a cast. Accept a named ` +
                  `type instead.`,
              ),
            );
          }
        }
      }
    }

    return findings;
  },
};

/**
 * What to call the parameter in the finding.
 *
 * A destructured or rest parameter has no single name, so it is quoted as
 * written. That is the whole reason this reads TEXT rather than an identifier:
 * `({ invoice, total })` is one subject with two fields, and naming either one
 * of them sends the reader to the wrong half of the fix.
 */
function parameterName(file: SourceFile, parameter: Node): string {
  const named = parameter as Node & { name?: Node & { kind: SyntaxKind; text?: string } };
  if (named.name?.kind === SyntaxKind.Identifier && named.name.text !== undefined) {
    return named.name.text;
  }
  return named.name === undefined ? "?" : named.name.getText(file);
}
